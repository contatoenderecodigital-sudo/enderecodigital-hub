// Prova a logica de fuso e de geracao de vagas sem subir nada.
// Roda com: node testes/agenda.test.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";

// Compila so o modulo da agenda para JS e importa.
execFileSync("npx", ["tsc", "lib/groow/agenda.ts", "--target", "es2022", "--module", "esnext",
  "--moduleResolution", "bundler", "--outDir", ".tmp-teste", "--skipLibCheck"],
  { stdio: "inherit", shell: true });
writeFileSync(".tmp-teste/package.json", '{"type":"module"}');
const A = await import("../.tmp-teste/agenda.js");

let falhas = 0;
const ok = (nome, cond, extra = "") => {
  if (cond) console.log("  ok   " + nome);
  else { falhas++; console.log("  FALHA " + nome + (extra ? "  -> " + extra : "")); }
};

const FUSO = "America/Sao_Paulo";

console.log("\nfuso horario");
{
  // 03/09/2026 as 09:00 em Sao Paulo (UTC-3) e 12:00 UTC
  const d = A.instanteLocal(FUSO, 2026, 9, 3, 9, 0);
  ok("09:00 de SP vira 12:00 UTC", d.toISOString() === "2026-09-03T12:00:00.000Z", d.toISOString());
  const p = A.partesLocais(FUSO, d);
  ok("dia da semana certo (quinta = 4)", p.diaSemana === 4, String(p.diaSemana));
  ok("chave local certa", p.chave === "2026-09-03", p.chave);
}
{
  // 21:00 de SP e 00:00 UTC do dia SEGUINTE. A chave tem que continuar no dia certo.
  const d = A.instanteLocal(FUSO, 2026, 9, 3, 21, 0);
  ok("21:00 nao pula de dia", A.partesLocais(FUSO, d).chave === "2026-09-03", A.partesLocais(FUSO, d).chave);
}

const cfg = {
  duracao_min: 30, intervalo_min: 15, aviso_min_horas: 4, janela_dias: 10,
  max_por_dia: 4, fuso: FUSO,
  janelas: [
    { dia: 4, de: "09:00", ate: "11:30" },
    { dia: 4, de: "14:30", ate: "16:00" },
  ],
};
const agora = new Date("2026-09-01T12:00:00.000Z"); // 01/09 09:00 SP, terca
const de = new Date("2026-09-03T00:00:00.000Z");
const ate = new Date("2026-09-04T00:00:00.000Z");

console.log("\ngeracao de vagas");
{
  const v = A.gerarVagas(cfg, [], de, ate, agora);
  const horas = v.map(x => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(x.inicio));
  ok("5 vagas de manha e 3 de tarde", v.length === 8, `${v.length}: ${horas.join(",")}`);
  ok("comeca 09:00", horas[0] === "09:00", horas[0]);
  ok("ultima da manha 11:00", horas[4] === "11:00", horas[4]);
  ok("nao passa das 16:00", horas[horas.length - 1] === "15:30", horas[horas.length - 1]);
}

console.log("\nocupado e intervalo");
{
  const ocupados = [{ inicio: new Date("2026-09-03T13:00:00.000Z"), fim: new Date("2026-09-03T13:30:00.000Z") }]; // 10:00 SP
  const v = A.gerarVagas(cfg, ocupados, de, ate, agora);
  const horas = v.map(x => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(x.inicio));
  ok("some a vaga das 10:00", !horas.includes("10:00"), horas.join(","));
  ok("some 09:30 e 10:30 pelo intervalo de 15min", !horas.includes("09:30") && !horas.includes("10:30"), horas.join(","));
  ok("09:00 continua livre", horas.includes("09:00"), horas.join(","));
}

console.log("\naviso minimo");
{
  const agoraColado = new Date("2026-09-03T10:00:00.000Z"); // 07:00 SP do proprio dia
  const v = A.gerarVagas(cfg, [], de, ate, agoraColado);
  const horas = v.map(x => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(x.inicio));
  ok("corta o que esta a menos de 4h", !horas.includes("09:00") && !horas.includes("10:30"), horas.join(","));
  ok("mantem 11:00, que esta a 4h", horas.includes("11:00"), horas.join(","));
}

console.log("\nteto por dia");
{
  const cheio = Array.from({ length: 4 }, (_, i) => {
    const h = String(12 + i).padStart(2, "0");
    return {
      inicio: new Date(`2026-09-03T${h}:00:00.000Z`),
      fim: new Date(`2026-09-03T${h}:30:00.000Z`),
    };
  });
  const v = A.gerarVagas(cfg, cheio, de, ate, agora);
  ok("dia com 4 reunioes some inteiro", v.length === 0, String(v.length));
}

console.log("\njanela de dias");
{
  const longe = new Date("2026-09-20T00:00:00.000Z");
  const v = A.gerarVagas(cfg, [], de, longe, agora);
  const ultima = v[v.length - 1];
  const limite = agora.getTime() + cfg.janela_dias * 86400000;
  ok("nada depois de 10 dias", !ultima || ultima.inicio.getTime() <= limite, ultima?.inicio.toISOString());
}

console.log("");
console.log("data podre nao derruba");
{
  const podre = [{ inicio: new Date("nao e data"), fim: new Date("nao e data") }];
  let quebrou = false;
  let v = [];
  try { v = A.gerarVagas(cfg, podre, de, ate, agora); } catch { quebrou = true; }
  ok("segue gerando com ocupado invalido", !quebrou && v.length === 8, quebrou ? "estourou" : String(v.length));
}

rmSync(".tmp-teste", { recursive: true, force: true });
console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\ntudo passou\n");
process.exit(falhas ? 1 : 0);
