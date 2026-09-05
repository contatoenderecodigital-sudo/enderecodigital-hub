import "server-only";
import { query } from "./db";
import { FUSO } from "./agenda";

export const FORMAS_CAIXA = {
  dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito",
  fiado: "Fiado", pacote: "Pacote", cortesia: "Cortesia", sem_forma: "Não informado",
} as const;
export type FormaCaixa = keyof typeof FORMAS_CAIXA;

export type ComandaCaixa = {
  id: string;
  numero: number | null;
  status: "aberta" | "fechada";
  cliente_nome: string | null;
  forma_pagamento: string | null;
  total_cent: number;
  desconto_cent: number;
  taxa_cent: number;
  fechada_hora: string | null;
};

export function dataCaixaValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000")) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function hojeCaixa(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function formaCaixa(forma: string | null): FormaCaixa {
  return forma && Object.hasOwn(FORMAS_CAIXA, forma) ? forma as FormaCaixa : "sem_forma";
}

export function resumirCaixa(comandas: ComandaCaixa[]) {
  const formas = (Object.keys(FORMAS_CAIXA) as FormaCaixa[]).map((forma) => ({
    forma, rotulo: FORMAS_CAIXA[forma], quantidade: 0, total_cent: 0, taxa_cent: 0,
    recebimento: ["dinheiro", "pix", "debito", "credito"].includes(forma),
  }));
  let abertas = 0;
  let aberto_cent = 0;
  let desconto_cent = 0;
  const fechadas: ComandaCaixa[] = [];
  for (const comanda of comandas) {
    if (comanda.status === "aberta") {
      abertas++;
      aberto_cent += comanda.total_cent;
      continue;
    }
    if (comanda.status !== "fechada") continue;
    fechadas.push(comanda);
    desconto_cent += comanda.desconto_cent;
    const grupo = formas.find((item) => item.forma === formaCaixa(comanda.forma_pagamento))!;
    grupo.quantidade++;
    grupo.total_cent += comanda.total_cent;
    grupo.taxa_cent += comanda.taxa_cent;
  }
  return {
    formas, fechadas, abertas, aberto_cent, desconto_cent,
    total_cent: formas.reduce((soma, item) => soma + item.total_cent, 0),
    taxa_cent: formas.reduce((soma, item) => soma + item.taxa_cent, 0),
    recebimento_cent: formas.filter((item) => item.recebimento).reduce((soma, item) => soma + item.total_cent - item.taxa_cent, 0),
  };
}

/** Somente leitura. O schema atual não registra fechamento nem contagem do caixa. */
export async function conferirCaixaDoDia(negocioId: string, dia: string) {
  if (!negocioId) throw new Error("Negócio não informado.");
  if (!dataCaixaValida(dia)) throw new Error("Data inválida.");
  const { rows } = await query<ComandaCaixa>(
    `SELECT cm.id, cm.numero, cm.status, cl.nome AS cliente_nome,
            cm.forma_pagamento, cm.total_cent, cm.desconto_cent, cm.taxa_cent,
            to_char(cm.fechada_em AT TIME ZONE $3, 'HH24:MI') AS fechada_hora
       FROM agenda_comandas cm
       LEFT JOIN agenda_clientes cl ON cl.id = cm.cliente_id AND cl.negocio_id = cm.negocio_id
      WHERE cm.negocio_id = $1
        AND ((cm.status = 'fechada'
              AND cm.fechada_em >= ($2::date::timestamp AT TIME ZONE $3)
              AND cm.fechada_em < (($2::date + 1)::timestamp AT TIME ZONE $3))
          OR (cm.status = 'aberta'
              AND cm.aberta_em < (($2::date + 1)::timestamp AT TIME ZONE $3)))
      ORDER BY cm.fechada_em, cm.id`,
    [negocioId, dia, FUSO],
  );
  return resumirCaixa(rows);
}
