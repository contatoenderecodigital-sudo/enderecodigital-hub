import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const fonte = readFileSync(join(raiz, "lib", "agenda-produtos.ts"), "utf8");
const compilado = ts.transpileModule(fonte, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  fileName: "lib/agenda-produtos.ts",
}).outputText;

const bancoProibido = () => { throw new Error("o teste unitario tentou acessar o banco"); };
const modulo = { exports: {} };
const requireIsolado = (id) => {
  if (id === "server-only") return {};
  if (id === "./db") return { pool: { connect: bancoProibido }, query: bancoProibido };
  if (id === "./agenda") return { FUSO: "America/Sao_Paulo" };
  return require(id);
};
new Function("require", "exports", "module", compilado)(requireIsolado, modulo.exports, modulo);

test("paraQuantidade entende decimal brasileiro e limita a tres casas", () => {
  assert.equal(modulo.exports.paraQuantidade("1,25"), 1.25);
  assert.equal(modulo.exports.paraQuantidade("0,3338"), 0.334);
  assert.equal(modulo.exports.paraQuantidade("1.000"), 1_000);
  assert.equal(modulo.exports.paraQuantidade("invalido"), 0);
});
test("movimentos de estoque sao append-only na camada da aplicacao", () => {
  assert.doesNotMatch(fonte, /UPDATE\s+agenda_produto_movimentos/i);
  assert.doesNotMatch(fonte, /DELETE\s+FROM\s+agenda_produto_movimentos/i);
  assert.match(fonte, /INSERT INTO agenda_produto_movimentos/);
});

test("venda trava produtos e recusa saldo insuficiente antes da baixa", () => {
  assert.match(fonte, /agenda_produtos[\s\S]*FOR UPDATE/);
  assert.match(fonte, /Estoque insuficiente para/);
});

test("cancelamento insere estorno e preserva a comanda", () => {
  assert.match(fonte, /'ajuste'/);
  assert.match(fonte, /Estorno da comanda/);
  assert.match(fonte, /UPDATE agenda_comandas SET status = 'cancelada'/);
  assert.doesNotMatch(fonte, /DELETE\s+FROM\s+agenda_comandas/i);
});
