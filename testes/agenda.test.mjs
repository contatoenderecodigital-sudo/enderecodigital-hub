import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const fonte = readFileSync(join(raiz, "lib", "agenda.ts"), "utf8");
const compilado = ts.transpileModule(fonte, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
  fileName: "lib/agenda.ts",
}).outputText;

const modulo = { exports: {} };
const bancoProibido = () => {
  throw new Error("o teste unitário tentou acessar o banco");
};
const requireIsolado = (id) => {
  if (id === "server-only") return {};
  if (id === "./db") return { pool: { connect: bancoProibido }, query: bancoProibido };
  return require(id);
};
new Function("require", "exports", "module", compilado)(
  requireIsolado,
  modulo.exports,
  modulo,
);

const { emReais, paraCentavos } = modulo.exports;

test("paraCentavos aceita os formatos usados no balcão", () => {
  assert.equal(paraCentavos("45"), 4_500);
  assert.equal(paraCentavos("45,50"), 4_550);
  assert.equal(paraCentavos("R$ 1.250,90"), 125_090);
  assert.equal(paraCentavos("-12,34"), -1_234);
});

test("paraCentavos arredonda frações e neutraliza entrada inválida", () => {
  assert.equal(paraCentavos("0,009"), 1);
  assert.equal(paraCentavos(""), 0);
  assert.equal(paraCentavos("sem valor"), 0);
});

test("emReais formata centavos como moeda brasileira", () => {
  const espacosNormalizados = (valor) => valor.replace(/\s/g, " ");
  assert.equal(espacosNormalizados(emReais(4_550)), "R$ 45,50");
  assert.equal(espacosNormalizados(emReais(125_090)), "R$ 1.250,90");
  assert.equal(espacosNormalizados(emReais(-1_234)), "-R$ 12,34");
});
