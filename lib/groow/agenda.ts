/**
 * Motor de agenda proprio.
 *
 * Gera as vagas a partir das janelas configuradas, tira o que ja esta ocupado e
 * aplica as regras (aviso minimo, janela de dias, teto por dia). O Google entra
 * so para dizer o que esta ocupado e para criar o evento; a decisao de quais
 * horarios existem e nossa.
 *
 * Sem dependencia de banco de proposito: da para testar a geracao com ocupados
 * de mentira, sem subir nada.
 */

export interface Janela {
  /** getDay() do JS: 0 domingo, 6 sabado */
  dia: number;
  /** "09:00" */
  de: string;
  /** "11:30" */
  ate: string;
}

export interface ConfigAgenda {
  duracao_min: number;
  intervalo_min: number;
  aviso_min_horas: number;
  janela_dias: number;
  max_por_dia: number;
  fuso: string;
  janelas: Janela[];
}

export interface Ocupado {
  inicio: Date;
  fim: Date;
}

export interface Vaga {
  /** instante em UTC */
  inicio: Date;
  fim: Date;
}

/**
 * Quantos minutos o fuso esta a frente do UTC naquele instante.
 *
 * Feito com Intl e nao com getTimezoneOffset porque aquele responde pelo fuso
 * de QUEM RODA o codigo. O servidor roda em UTC no container, e a agenda e de
 * Sao Paulo: sem isto todas as vagas sairiam tres horas erradas.
 */
export function offsetMinutos(fuso: string, quando: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const parte of fmt.formatToParts(quando)) {
    if (parte.type !== "literal") p[parte.type] = parte.value;
  }
  // "24" aparece a meia-noite em alguns ambientes e quebraria o Date.UTC.
  const hora = p.hour === "24" ? 0 : Number(p.hour);
  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hora,
    Number(p.minute),
    Number(p.second)
  );
  return (comoUtc - quando.getTime()) / 60000;
}

/**
 * Hora de parede naquele fuso vira instante UTC.
 *
 * Duas passadas de proposito: na virada de horario de verao o offset do chute
 * inicial pode ser o do lado errado da mudanca. O Brasil nao tem mais horario
 * de verao, mas o codigo nao pode depender disso continuar assim.
 */
export function instanteLocal(
  fuso: string,
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number
): Date {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const primeiro = new Date(alvo - offsetMinutos(fuso, new Date(alvo)) * 60000);
  return new Date(alvo - offsetMinutos(fuso, primeiro) * 60000);
}

/** Partes do dia naquele fuso, para saber o dia da semana certo. */
export function partesLocais(fuso: string, quando: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const parte of fmt.formatToParts(quando)) {
    if (parte.type !== "literal") p[parte.type] = parte.value;
  }
  const semana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    diaSemana: semana,
    chave: `${p.year}-${p.month}-${p.day}`,
  };
}

function minutosDe(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function encosta(a: Vaga, o: Ocupado, folgaMin: number): boolean {
  const folga = folgaMin * 60000;
  return a.inicio.getTime() < o.fim.getTime() + folga && a.fim.getTime() + folga > o.inicio.getTime();
}

/**
 * As vagas livres entre `de` e `ate`.
 *
 * `agora` entra por parametro em vez de new Date() dentro: assim da para testar
 * o aviso minimo sem depender do relogio da maquina.
 */
export function gerarVagas(
  cfg: ConfigAgenda,
  ocupados: Ocupado[],
  de: Date,
  ate: Date,
  agora: Date = new Date()
): Vaga[] {
  const duracao = Math.max(5, cfg.duracao_min);
  const passo = duracao;
  const cedoDemais = agora.getTime() + cfg.aviso_min_horas * 3600000;
  const tardeDemais = agora.getTime() + cfg.janela_dias * 86400000;

  const inicioBusca = new Date(Math.max(de.getTime(), agora.getTime()));
  const fimBusca = new Date(Math.min(ate.getTime(), tardeDemais));
  if (fimBusca <= inicioBusca) return [];

  // Quantas ja existem em cada dia, para o teto por dia. Conta o ocupado que
  // caiu dentro de alguma janela, que e o que de fato veio de reuniao nossa.
  const porDia = new Map<string, number>();
  for (const o of ocupados) {
    // Data podre vinda de fora nao pode derrubar a agenda inteira: o Google
    // devolve evento sem hora (dia inteiro) e isso vira Invalid Date aqui.
    if (Number.isNaN(o.inicio?.getTime?.())) continue;
    const k = partesLocais(cfg.fuso, o.inicio).chave;
    porDia.set(k, (porDia.get(k) || 0) + 1);
  }

  const vagas: Vaga[] = [];
  // Anda dia a dia pelo fuso da agenda, nao por UTC.
  const cursor = new Date(inicioBusca);
  cursor.setUTCHours(0, 0, 0, 0);

  for (let guarda = 0; guarda < 400 && cursor.getTime() <= fimBusca.getTime() + 86400000; guarda++) {
    const p = partesLocais(cfg.fuso, cursor);
    const doDia = cfg.janelas.filter((j) => j.dia === p.diaSemana);

    if (doDia.length && (porDia.get(p.chave) || 0) < cfg.max_por_dia) {
      for (const j of doDia) {
        const abre = minutosDe(j.de);
        const fecha = minutosDe(j.ate);
        if (abre == null || fecha == null || fecha <= abre) continue;

        for (let m = abre; m + duracao <= fecha; m += passo) {
          const inicio = instanteLocal(cfg.fuso, p.ano, p.mes, p.dia, Math.floor(m / 60), m % 60);
          const fim = new Date(inicio.getTime() + duracao * 60000);

          if (inicio.getTime() < cedoDemais) continue;
          if (inicio.getTime() > tardeDemais) continue;
          if (inicio < de || fim > ate) continue;
          if (
            ocupados.some(
              (o) =>
                !Number.isNaN(o.inicio?.getTime?.()) &&
                !Number.isNaN(o.fim?.getTime?.()) &&
                encosta({ inicio, fim }, o, cfg.intervalo_min)
            )
          )
            continue;

          vagas.push({ inicio, fim });
        }
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  vagas.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  return vagas;
}

/** Agrupa as vagas por dia local, que e como a tela precisa mostrar. */
export function porDiaLocal(fuso: string, vagas: Vaga[]): Map<string, Vaga[]> {
  const m = new Map<string, Vaga[]>();
  for (const v of vagas) {
    const k = partesLocais(fuso, v.inicio).chave;
    const lista = m.get(k);
    if (lista) lista.push(v);
    else m.set(k, [v]);
  }
  return m;
}
