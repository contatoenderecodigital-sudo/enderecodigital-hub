// Testa o modulo MeuBarbeiro real, com banco simulado e sem acessar producao.
// Executar: node --test testes/meubarbeiro-financeiro.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(
  readFileSync(join(__dirname, "../lib/agenda.ts"), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;

function fixture(precos = [100, 100], initialStatus = "confirmado") {
  const state = { calls: [], comandas: [], itens: [], pontos: [], statuses: {}, released: 0 };
  let lockTail = Promise.resolve();
  async function connect() {
    let unlock;
    const run = async (sql, params = []) => {
      state.calls.push({ sql, params });
      if (sql.includes("pg_advisory_xact_lock")) {
        const previous = lockTail;
        lockTail = new Promise(resolve => { unlock = resolve; });
        await previous;
      } else if (sql.includes("SELECT id, status") && sql.includes("agenda_agendamentos")) {
        return { rows: [{ id: params[1], status: state.statuses[params[1]] ?? initialStatus, cliente_id: "cliente", filial_id: null }] };
      } else if (sql.includes("FROM agenda_agendamento_servicos")) {
        return { rows: precos.map((preco_cent, n) => ({ servico_id: `s${n}`, profissional_id: "p", preco_cent, nome: `Servico ${n}`, pct: 50 })) };
      } else if (sql.includes("max(numero)")) {
        return { rows: [{ n: Math.max(0, ...state.comandas.map(c => c.numero)) + 1 }] };
      } else if (sql.includes("INSERT INTO agenda_comandas")) {
        const id = `c${state.comandas.length + 1}`;
        state.comandas.push({ id, agendamento: params[3], numero: params[4], desconto: params[6], total: params[7], status: "fechada" });
        return { rows: [{ id }] };
      } else if (sql.includes("INSERT INTO agenda_comanda_itens")) {
        state.itens.push({ comanda: params[1], preco: params[5], desconto: params[6], total: params[7], comissao: params[9] });
      } else if (sql.includes("SET status = 'concluido'")) {
        state.statuses[params[1]] = "concluido";
      } else if (sql.includes("SET status = 'confirmado'")) {
        state.statuses[params[1]] = "confirmado";
      } else if (sql.includes("SELECT fidelidade_ativa")) {
        return { rows: [{ fidelidade_ativa: true, pontos_por_real: 1 }] };
      } else if (sql.includes("UPDATE agenda_comandas")) {
        const rows = state.comandas.filter(c => c.agendamento === params[1] && c.status === "fechada");
        rows.forEach(c => { c.status = "cancelada"; });
        return { rows };
      } else if (sql.includes("INSERT INTO agenda_fidelidade_movimentos")) {
        if (sql.includes("Estorno por reabertura")) {
          const saldo = state.pontos.filter(p => p.comanda === params[1]).reduce((sum, p) => sum + p.valor, 0);
          if (saldo) state.pontos.push({ comanda: params[1], valor: -saldo });
        } else {
          state.pontos.push({ comanda: params[3], valor: params[2] });
        }
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") unlock?.();
      return { rows: [] };
    };
    return { query: run, release() { state.released++; } };
  }
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: mod.exports,
    require(name) {
      if (name === "server-only") return {};
      if (name === "./db") return {
        pool: { connect },
        async query(sql, params) { return (await connect()).query(sql, params); },
      };
      throw new Error(`Dependencia inesperada: ${name}`);
    },
  });
  return { api: mod.exports, state };
}

test("mudarStatus nao permite concluir sem gerar comanda", async () => {
  const { api, state } = fixture();
  await assert.rejects(api.mudarStatus("negocio", "a1", "concluido"), /fechamento/);
  assert.equal(state.calls.length, 0);
});

test("mudanca simples nao altera atendimento ja fechado", async () => {
  const { api, state } = fixture();
  await api.mudarStatus("negocio", "a1", "cancelado");
  assert.match(state.calls[0].sql, /AND status IN \('pendente','confirmado','em_atendimento'\)/);
});

test("desconto de um centavo em dois itens conserva o total da comanda", async () => {
  const { api, state } = fixture();
  await api.concluirAtendimento("negocio", "a1", { desconto_cent: 1 });
  assert.equal(state.itens.reduce((sum, i) => sum + i.desconto, 0), 1);
  assert.equal(state.itens.reduce((sum, i) => sum + i.total, 0), 199);
  assert.equal(state.comandas[0].total, 199);
  assert.equal(state.calls.at(-1).sql, "COMMIT");
  assert.equal(state.released, 1);
});

test("rateio conserva centavos com precos diferentes, desconto total e itens gratuitos", async () => {
  for (const precos of [[0, 0], [0, 101, 399], [1, 1, 1], [10000, 3, 19]]) {
    for (const desconto of [0, 1, 2, 99, 50000]) {
      const { api, state } = fixture(precos);
      await api.concluirAtendimento("negocio", "a1", { desconto_cent: desconto });
      assert.equal(state.itens.reduce((sum, i) => sum + i.desconto, 0), state.comandas[0].desconto);
      assert.equal(state.itens.reduce((sum, i) => sum + i.total, 0), state.comandas[0].total);
      assert.ok(state.itens.every(i => i.desconto >= 0 && i.desconto <= i.preco));
      assert.ok(state.itens.every(i => i.comissao === Math.round(i.total * 0.5)));
    }
  }
});

test("desconto invalido desfaz a transacao antes de criar comanda", async () => {
  for (const desconto_cent of [-1, 0.5, NaN, Infinity]) {
    const { api, state } = fixture();
    await assert.rejects(api.concluirAtendimento("negocio", "a1", { desconto_cent }), /centavos inteiros/);
    assert.equal(state.comandas.length, 0);
    assert.equal(state.calls.at(-1).sql, "ROLLBACK");
    assert.equal(state.released, 1);
  }
});

test("fechamentos concorrentes de agendamentos distintos recebem numeros distintos", async () => {
  const { api, state } = fixture();
  await Promise.all([
    api.concluirAtendimento("negocio", "a1"),
    api.concluirAtendimento("negocio", "a2"),
  ]);
  assert.deepEqual(state.comandas.map(c => c.numero), [1, 2]);
  const locks = state.calls.filter(c => c.sql.includes("pg_advisory_xact_lock"));
  assert.equal(locks.length, 2);
  assert.equal(locks[0].params[0], locks[1].params[0]);
  const numbering = state.calls.find(c => c.sql.includes("max(numero)"));
  assert.match(numbering.sql, /\(now\(\) AT TIME ZONE \$2\)::date/);
  assert.doesNotMatch(numbering.sql, /CURRENT_DATE/);
});

test("reabrir estorna fidelidade, conserva historico e permite pontuar apenas uma vez ao fechar de novo", async () => {
  const { api, state } = fixture([5000]);
  await api.concluirAtendimento("negocio", "a1");
  assert.equal(state.pontos[0].valor, 50);
  await api.reabrirAtendimento("negocio", "a1");
  assert.equal(state.comandas[0].status, "cancelada");
  assert.equal(state.pontos.reduce((sum, p) => sum + p.valor, 0), 0);
  assert.equal(state.pontos.length, 2);
  await assert.rejects(api.reabrirAtendimento("negocio", "a1"), /concluído/);
  assert.equal(state.pontos.length, 2);
  await api.concluirAtendimento("negocio", "a1");
  assert.equal(state.pontos.reduce((sum, p) => sum + p.valor, 0), 50);
  assert.equal(state.comandas.length, 2);
  const reversal = state.calls.find(c => c.sql.includes("Estorno por reabertura"));
  assert.match(reversal.sql, /WHERE negocio_id = \$1 AND comanda_id = \$2/);
  assert.match(reversal.sql, /HAVING sum\(pontos\) <> 0/);
});
