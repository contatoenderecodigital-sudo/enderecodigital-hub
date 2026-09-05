const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function carregarBancoSimulado(executarQuery, conectar) {
  const fonte = readFileSync(join(__dirname, "../lib/agenda-comissoes.ts"), "utf8");
  const compilado = ts.transpileModule(fonte, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(compilado, {
    exports: modulo.exports,
    module: modulo,
    require(nome) {
      if (nome === "server-only") return {};
      if (nome === "./db") {
        return {
          query: executarQuery ?? (async () => ({ rows: [] })),
          pool: { connect: conectar ?? (async () => { throw new Error("conexão não esperada"); }) },
        };
      }
      throw new Error(`Dependência inesperada: ${nome}`);
    },
    Intl,
    Date,
    URLSearchParams,
  });
  return modulo.exports;
}

test("período mensal trata fevereiro bissexto e entrada inválida", () => {
  const api = carregarBancoSimulado();
  const fevereiro = api.periodoMensal("2024-02");
  assert.equal(fevereiro.inicio, "2024-02-01");
  assert.equal(fevereiro.fim, "2024-02-29");

  const padrao = api.periodoMensal("../../outro-tenant", new Date("2026-09-10T12:00:00Z"));
  assert.equal(padrao.mes, "2026-09");
});

test("lançamento valida profissional e período dentro do tenant", async () => {
  const chamadas = [];
  const api = carregarBancoSimulado(async (sql, params) => {
    chamadas.push({ sql, params });
    return { rows: [{ id: "l1" }] };
  });

  const id = await api.registrarLancamentoProfissional("negocio-a", "prof-a", {
    tipo: "vale",
    valor_cent: 2500,
    descricao: "Vale semanal",
    data: "2026-09-10",
  });

  assert.equal(id, "l1");
  assert.deepEqual(Array.from(chamadas[0].params), [
    "negocio-a", "prof-a", "vale", 2500, "Vale semanal", "2026-09-10",
  ]);
  assert.match(chamadas[0].sql, /p\.negocio_id = \$1/);
  assert.match(chamadas[0].sql, /f\.negocio_id = \$1/);
  assert.match(chamadas[0].sql, /f\.profissional_id = p\.id/);
  assert.match(chamadas[0].sql, /f\.status IN \('fechado','pago'\)/);
});

test("fechamento mensal congela líquido e serializa concorrência", async () => {
  const chamadas = [];
  const cliente = {
    async query(sql, params = []) {
      chamadas.push({ sql, params });
      if (sql.includes("SELECT id FROM agenda_profissionais")) return { rows: [{ id: "prof-a" }] };
      if (sql.includes("FROM agenda_comissao_fechamentos") && sql.includes("FOR UPDATE")) return { rows: [] };
      if (sql.includes("sum(i.total_cent)")) {
        return { rows: [{ servicos_cent: 10000, produtos_cent: 3000, comissao_cent: 5500 }] };
      }
      if (sql.includes("FROM agenda_profissional_lancamentos")) {
        return { rows: [{ lancamentos_cent: -1200 }] };
      }
      if (sql.includes("INSERT INTO agenda_comissao_fechamentos")) {
        return {
          rows: [{
            id: "f1", status: "fechado", fechado_em: "2026-10-01T12:00:00Z", pago_em: null,
            observacao: params[9], servicos_cent: params[4], produtos_cent: params[5],
            comissao_cent: params[6], lancamentos_cent: params[7], liquido_cent: params[8],
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  const api = carregarBancoSimulado(undefined, async () => cliente);

  const fechado = await api.fecharComissaoMensal(
    "negocio-a",
    "prof-a",
    api.periodoMensal("2026-09"),
    "Conferido",
  );

  assert.equal(fechado.liquido_cent, 4300);
  assert.equal(fechado.status, "fechado");
  const trava = chamadas.find((chamada) => chamada.sql.includes("pg_advisory_xact_lock"));
  assert.deepEqual(Array.from(trava.params), ["negocio-a", "prof-a:2026-09-01:2026-09-30"]);
  const gravacao = chamadas.find((chamada) => chamada.sql.includes("INSERT INTO agenda_comissao_fechamentos"));
  assert.equal(gravacao.params[8], 4300);
  assert.match(gravacao.sql, /agenda_comissao_fechamentos\.negocio_id = EXCLUDED\.negocio_id/);
  assert.equal(chamadas.at(-1).sql, "COMMIT");
});
