import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const fonte = readFileSync(new URL("../lib/agenda-caixa.ts", import.meta.url), "utf8");
const compilado = ts.transpileModule(fonte, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function carregar(query = () => { throw new Error("Acesso inesperado ao banco"); }) {
  const modulo = { exports: {} };
  new Function("require", "exports", "module", compilado)((id) => {
    if (id === "server-only") return {};
    if (id === "./db") return { query };
    if (id === "./agenda") return { FUSO: "America/Sao_Paulo" };
    return require(id);
  }, modulo.exports, modulo);
  return modulo.exports;
}

const caixa = carregar();
const comanda = (forma_pagamento, total_cent, taxa_cent = 0, extra = {}) => ({
  id: "comanda", numero: 1, status: "fechada", cliente_nome: null,
  forma_pagamento, total_cent, desconto_cent: 0, taxa_cent, fechada_hora: "18:00", ...extra,
});

test("caixa vazio mantém valores zerados e todas as formas disponíveis", () => {
  const resumo = caixa.resumirCaixa([]);
  assert.equal(resumo.formas.length, 8);
  assert.equal(resumo.total_cent, 0);
  assert.equal(resumo.recebimento_cent, 0);
  assert.equal(resumo.abertas, 0);
});

test("recebimento exclui fiado, pacote, cortesia e forma não informada sem ocultá-los do faturamento", () => {
  const resumo = caixa.resumirCaixa([
    comanda("dinheiro", 4500), comanda("pix", 6500, 10),
    comanda("debito", 5000, 100), comanda("credito", 8000, 240),
    comanda("fiado", 3000), comanda("pacote", 4000), comanda("cortesia", 1000),
    comanda(null, 2000), comanda("forma_legada", 500),
  ]);
  assert.equal(resumo.fechadas.length, 9);
  assert.equal(resumo.total_cent, 34500);
  assert.equal(resumo.taxa_cent, 350);
  assert.equal(resumo.recebimento_cent, 23650);
  assert.equal(resumo.formas.find((item) => item.forma === "sem_forma").quantidade, 2);
});

test("desconto já está no total e comandas abertas e canceladas não viram faturamento", () => {
  const resumo = caixa.resumirCaixa([
    comanda("dinheiro", 900, 0, { desconto_cent: 100 }),
    comanda("pix", 2000, 0, { status: "aberta" }),
    comanda("credito", 5000, 200, { status: "cancelada" }),
  ]);
  assert.equal(resumo.total_cent, 900);
  assert.equal(resumo.recebimento_cent, 900);
  assert.equal(resumo.desconto_cent, 100);
  assert.equal(resumo.abertas, 1);
  assert.equal(resumo.aberto_cent, 2000);
  assert.equal(resumo.taxa_cent, 0);
});

test("validação de calendário rejeita dias impossíveis, formato ambíguo e parâmetros repetidos", () => {
  for (const valor of ["2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "05/09/2026", ["2026-09-05"], undefined]) {
    assert.equal(caixa.dataCaixaValida(valor), false, String(valor));
  }
  for (const valor of ["2024-02-29", "2026-09-05"]) assert.equal(caixa.dataCaixaValida(valor), true);
});

test("consulta usa tenant obrigatório, data de fechamento e limites do dia em São Paulo, sem escrita", async () => {
  const chamadas = [];
  const modulo = carregar(async (sql, valores) => {
    chamadas.push({ sql, valores });
    return { rows: [comanda("pix", 12345, 67)] };
  });
  const resumo = await modulo.conferirCaixaDoDia("tenant-da-sessao", "2026-09-05");
  assert.equal(resumo.recebimento_cent, 12278);
  assert.equal(chamadas.length, 1);
  const { sql, valores } = chamadas[0];
  assert.deepEqual(valores, ["tenant-da-sessao", "2026-09-05", "America/Sao_Paulo"]);
  assert.match(sql, /WHERE cm\.negocio_id = \$1/);
  assert.match(sql, /cl\.negocio_id = cm\.negocio_id/);
  assert.match(sql, /cm\.fechada_em >=/);
  assert.match(sql, /cm\.fechada_em </);
  assert.match(sql, /AT TIME ZONE \$3/);
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE)\b/);
  await assert.rejects(modulo.conferirCaixaDoDia("", "2026-09-05"), /Negócio/);
  await assert.rejects(modulo.conferirCaixaDoDia("tenant", "2026-02-30"), /Data inválida/);
  assert.equal(chamadas.length, 1);
});

test("tela e navegação condicionam o caixa à Agenda e obtêm o tenant da sessão", () => {
  const pagina = readFileSync(new URL("../app/painel/caixa/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/painel/layout.tsx", import.meta.url), "utf8");
  assert.match(pagina, /activeNegocioId\(sessao\)/);
  assert.match(pagina, /!modulosEfetivos\(negocio, hub\)\.agenda/);
  assert.match(pagina, /conferirCaixaDoDia\(negocioId, dia\)/);
  assert.match(layout, /href: "\/painel\/caixa", ligado: !!mods\?\.agenda/);
});
