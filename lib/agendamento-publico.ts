import "server-only";

import { query } from "@/lib/db";
import {
  HorarioOcupado,
  acharOuCriarCliente,
  criarAgendamento,
  horariosLivres,
  listarProfissionais,
  listarServicos,
} from "@/lib/agenda";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type AgendamentoPublico = {
  negocioId: string;
  nome: string;
  cor: string | null;
  logo: string | null;
  maxDias: number;
  profissionais: { id: string; nome: string; apelido: string | null; foto: string | null; cor: string | null }[];
  servicos: { id: string; nome: string; descricao: string | null; duracaoMin: number; precoCent: number }[];
};

type NegocioPublico = { id: string; nome: string; marca_cor: string | null; marca_logo: string | null };

function slugValido(slug: string) {
  return SLUG_RE.test(slug);
}

async function negocioPorSlug(slug: string): Promise<NegocioPublico | null> {
  if (!slugValido(slug)) return null;
  const { rows } = await query<NegocioPublico>(
    `SELECT n.id, COALESCE(n.nome_fantasia, n.nome) AS nome, n.marca_cor, n.marca_logo
       FROM negocios n
       JOIN hubs h ON h.id = n.hub_id
      WHERE n.slug = $1
        AND n.status = 'ativo'
        AND COALESCE(n.mod_site, h.mod_site, false)
        AND COALESCE(n.mod_agenda, h.mod_agenda, false)
      LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function catalogoPublico(slug: string): Promise<AgendamentoPublico | null> {
  const negocio = await negocioPorSlug(slug);
  if (!negocio) return null;

  const [config, profissionais, servicos] = await Promise.all([
    // A vitrine pública é somente leitura. `configDaAgenda` cria a linha de
    // configuração quando ela não existe, o que não é apropriado para um GET
    // anônimo. Enquanto a casa não salvou configuração, usa o mesmo padrão da
    // migration (60 dias).
    query<{ antecedencia_max_dias: number }>(
      `SELECT antecedencia_max_dias FROM agenda_config WHERE negocio_id = $1`,
      [negocio.id],
    ).then(({ rows }) => rows[0] ?? { antecedencia_max_dias: 60 }),
    listarProfissionais(negocio.id),
    listarServicos(negocio.id),
  ]);

  return {
    negocioId: negocio.id,
    nome: negocio.nome,
    cor: negocio.marca_cor,
    logo: negocio.marca_logo,
    maxDias: config.antecedencia_max_dias,
    profissionais: profissionais
      .filter((p) => p.ativo && p.aceita_online)
      .map(({ id, nome, apelido, foto, cor }) => ({ id, nome, apelido, foto, cor })),
    servicos: servicos
      .filter((s) => s.ativo && s.online)
      .map(({ id, nome, descricao, duracao_min, preco_cent }) => ({
        id, nome, descricao, duracaoMin: duracao_min, precoCent: preco_cent,
      })),
  };
}

function dataHoje(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function telefoneBrasil(valor: string): string | null {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.length <= 11) digitos = `55${digitos}`;
  return /^55\d{10,11}$/.test(digitos) ? digitos : null;
}

function validarIds(ids: string[]): boolean {
  return ids.length > 0 && ids.length <= 5 && new Set(ids).size === ids.length && ids.every((id) => UUID_RE.test(id));
}

async function duracaoParaReserva(negocioId: string, profissionalId: string, servicoIds: string[]): Promise<number | null> {
  const { rows } = await query<{ id: string; duracao_min: number; intervalo_pos_min: number }>(
    `SELECT s.id, COALESCE(ps.duracao_min, s.duracao_min)::int AS duracao_min, s.intervalo_pos_min
       FROM agenda_servicos s
       LEFT JOIN agenda_profissional_servicos ps
         ON ps.negocio_id = s.negocio_id AND ps.servico_id = s.id AND ps.profissional_id = $2
      WHERE s.negocio_id = $1 AND s.id = ANY($3::uuid[]) AND s.ativo AND s.online`,
    [negocioId, profissionalId, servicoIds],
  );
  if (rows.length !== servicoIds.length) return null;
  return rows.reduce((total, s) => total + s.duracao_min, 0) + Math.max(...rows.map((s) => s.intervalo_pos_min), 0);
}

export async function horariosPublicos(slug: string, profissionalId: string, servicoIds: string[], data: string) {
  if (!UUID_RE.test(profissionalId) || !validarIds(servicoIds) || !DATA_RE.test(data)) return null;
  const catalogo = await catalogoPublico(slug);
  if (!catalogo || !catalogo.profissionais.some((p) => p.id === profissionalId)) return null;
  if (!servicoIds.every((id) => catalogo.servicos.some((s) => s.id === id))) return null;
  const hoje = dataHoje();
  if (data < hoje || data > somarDias(hoje, catalogo.maxDias)) return [];
  const duracao = await duracaoParaReserva(catalogo.negocioId, profissionalId, servicoIds);
  return duracao ? horariosLivres(catalogo.negocioId, profissionalId, data, duracao) : null;
}

export class ErroReservaPublica extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function reservarPublico(slug: string, entrada: Record<string, unknown>): Promise<void> {
  const nome = String(entrada.nome || "").trim().replace(/\s+/g, " ");
  const telefone = telefoneBrasil(String(entrada.telefone || ""));
  const profissionalId = String(entrada.profissionalId || "");
  const data = String(entrada.data || "");
  const hora = String(entrada.hora || "");
  const servicoIds = Array.isArray(entrada.servicoIds) ? entrada.servicoIds.map(String) : [];
  if (nome.length < 2 || nome.length > 100 || !telefone || !UUID_RE.test(profissionalId) || !DATA_RE.test(data) || !HORA_RE.test(hora) || !validarIds(servicoIds)) {
    throw new ErroReservaPublica("Confira seus dados e tente novamente.");
  }

  const catalogo = await catalogoPublico(slug);
  if (!catalogo || !catalogo.profissionais.some((p) => p.id === profissionalId) || !servicoIds.every((id) => catalogo.servicos.some((s) => s.id === id))) {
    throw new ErroReservaPublica("Esta agenda não está disponível.", 404);
  }
  const horarios = await horariosPublicos(slug, profissionalId, servicoIds, data);
  if (!horarios?.includes(hora)) throw new ErroReservaPublica("Esse horário não está mais disponível.", 409);

  const clienteId = await acharOuCriarCliente(catalogo.negocioId, nome, telefone, "site");
  try {
    await criarAgendamento(catalogo.negocioId, {
      profissional_id: profissionalId,
      cliente_id: clienteId,
      inicio: `${data}T${hora}:00-03:00`,
      servico_ids: servicoIds,
      origem: "site",
    });
  } catch (erro) {
    if (erro instanceof HorarioOcupado) throw new ErroReservaPublica(erro.message, 409);
    throw erro;
  }
}
