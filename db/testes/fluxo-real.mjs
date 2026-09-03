// ============================================================================
// Teste de ponta a ponta contra o app rodando de verdade (dev ou produção).
//
//   node db/testes/fluxo-real.mjs http://localhost:3010
//
// Simula a noite inteira: cliente encosta o celular no cartão, pede, a cozinha
// vê, marca pronto, a comanda vai para a impressora, o garçom fecha a conta e
// um pedido de delivery entra pelo link. Usa a loja de demonstração.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const BASE = (process.argv[2] || "http://localhost:3010").replace(/\/$/, "");
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let falhas = 0;
const checa = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };

function lerEnv() {
  for (const arq of [".env.local", ".env"]) {
    const p = path.join(RAIZ, arq);
    if (!fs.existsSync(p)) continue;
    const m = /DATABASE_URL=(.*)/.exec(fs.readFileSync(p, "utf8"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return process.env.DATABASE_URL;
}

const db = new pg.Client({ connectionString: lerEnv() });
await db.connect();

const loja = (await db.query("SELECT * FROM food_lojas WHERE slug = 'boteco-demo'")).rows[0];
if (!loja) { console.log("rode antes: node db/instalar-food.mjs --demo"); process.exit(1); }

// mesa livre para o teste
// A mesa livre MENOS usada: rodar a suite varias vezes seguidas na mesma mesa
// bate no limite de pedidos por hora, que e protecao de producao e esta certa.
const mesa = (await db.query(
  `SELECT m.* FROM food_mesas m
    WHERE m.loja_id = $1 AND m.ativa = true
      AND NOT EXISTS (SELECT 1 FROM food_sessoes s WHERE s.mesa_id = m.id
                       AND s.status IN ('aberta','conta_pedida','em_pagamento','paga'))
    ORDER BY (SELECT MAX(p.criado_em) FROM food_pedidos p WHERE p.mesa_id = m.id) ASC NULLS FIRST,
             m.ordem
    LIMIT 1`, [loja.id])).rows[0];
// O tablet da praca que TEM produto. Os dois tablets da demonstracao nasceram
// no mesmo INSERT, entao `ORDER BY criado_em` empata e o Postgres as vezes
// devolvia o do bar, que nao tem item nenhum na fila: o teste acusava a cozinha
// de nao ter recebido o pedido, e a cozinha estava certa.
const kds = (await db.query(
  `SELECT d.* FROM food_dispositivos d
    WHERE d.loja_id = $1 AND d.tipo = 'kds' AND d.ativo = true
    ORDER BY (SELECT COUNT(*) FROM food_produtos p
               WHERE p.area_id = d.area_id AND p.ativo = true) DESC,
             d.nome
    LIMIT 1`, [loja.id])).rows[0];
const garcomTablet = (await db.query(
  "SELECT * FROM food_dispositivos WHERE loja_id = $1 AND tipo = 'garcom' LIMIT 1", [loja.id])).rows[0];
const impressora = (await db.query(
  "SELECT * FROM food_impressoras WHERE loja_id = $1 LIMIT 1", [loja.id])).rows[0];
const equipe = (await db.query(
  "SELECT * FROM food_equipe WHERE loja_id = $1 AND papel = 'garcom' LIMIT 1", [loja.id])).rows[0];
const bairro = (await db.query("SELECT * FROM food_bairros WHERE loja_id = $1 LIMIT 1", [loja.id])).rows[0];

// a impressora de verdade consome a fila o tempo todo; aqui esvaziamos antes de
// medir, senao o teste pega a comanda de uma rodada anterior
async function esvaziarFila(chave) {
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`${BASE}/api/food/print/${chave}`, { method: "POST" }).then((x) => x.json());
    if (!r.jobReady) return i;
    await fetch(`${BASE}/api/food/print/${chave}`);
    await fetch(`${BASE}/api/food/print/${chave}`, { method: "DELETE" });
  }
  return -1;
}

// Cada "celular" do teste tem seu pote de cookies, porque a API agora emite um
// PASSE (cookie httpOnly) ao entrar na mesa, e pedir exige esse passe.
const potes = new Map();
function pote(quem) {
  if (!potes.has(quem)) potes.set(quem, new Map());
  return potes.get(quem);
}
function guardaCookies(quem, r) {
  const cru = r.headers.getSetCookie?.() ?? [];
  for (const linha of cru) {
    const [par] = linha.split(";");
    const i = par.indexOf("=");
    if (i > 0) pote(quem).set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
}
function cabecalhoCookie(quem) {
  const c = pote(quem);
  if (!c.size) return {};
  return { Cookie: [...c].map(([k, v]) => `${k}=${v}`).join("; ") };
}

async function api(caminho, body, quem = "celular-1") {
  const r = await fetch(BASE + caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cabecalhoCookie(quem) },
    body: JSON.stringify(body),
  });
  guardaCookies(quem, r);
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

// ---------- 0. a casa fica aberta durante o teste
// Comanda nova so nasce com a casa aberta, e isso e regra de producao. Rodar a
// suite as duas da manha nao pode falhar por causa disso: o teste abre a
// demonstracao e devolve como estava no fim.
const abertoAntes = (await db.query(
  "SELECT aberto_manual FROM food_lojas WHERE id = $1", [loja.id])).rows[0].aberto_manual;
await db.query("UPDATE food_lojas SET aberto_manual = true WHERE id = $1", [loja.id]);
const devolverHorario = async () => {
  await db.query("UPDATE food_lojas SET aberto_manual = $2 WHERE id = $1", [loja.id, abertoAntes]);
};

// Os tablets começam SEM pareamento e com a janela aberta, que é o estado em
// que o dono acabou de gerar o link na configuração. No fim a janela volta a
// ficar aberta, senão o próximo que abrir o link da demonstração acha quebrado.
const prepararTablets = async (horas) => {
  await db.query(
    `UPDATE food_dispositivos
        SET segredo = NULL, pareado_em = NULL, pareado_ip = NULL, pareado_agente = NULL,
            parear_ate = now() + ($2 || ' hours')::interval
      WHERE loja_id = $1`,
    [loja.id, String(horas)]);
};
await prepararTablets(1);

// ---------- 0. fila de impressão zerada para o teste começar limpo
const sobras = await esvaziarFila(impressora.chave);
console.log(`fila de impressão zerada (${sobras} comanda(s) de rodadas anteriores)`);

// ---------- 1. o cliente encosta o celular no cartão
const dev1 = "teste-celular-" + Date.now();
const entrar = await api("/api/food/publico", { acao: "entrar", token: mesa.token, deviceId: dev1 });
checa(entrar.status === 200 && entrar.data.mesa?.numero === mesa.numero,
  `mesa ${mesa.numero} abre pelo cartão NFC`);
const cardapio = entrar.data.cardapio ?? [];
checa(cardapio.length > 0, `cardápio carregou com ${cardapio.length} categoria(s)`);

// ---------- 2. segundo celular entra na MESMA comanda
const entrar2 = await api("/api/food/publico",
  { acao: "entrar", token: mesa.token, deviceId: "teste-celular-2-" + Date.now() }, "celular-2");
checa(entrar2.data.sessao?.id === entrar.data.sessao?.id, "segundo celular cai na mesma comanda");

// ---------- 3. pedido do cliente
const prato = cardapio.flatMap((c) => c.produtos).find((p) => Number(p.preco) > 0 && !p.esgotado);
const pedir = await api("/api/food/publico", {
  acao: "pedir", token: mesa.token, deviceId: dev1,
  itens: [{ produto_id: prato.id, qtd: 2 }],
});
checa(pedir.status === 200 && pedir.data.ok,
  pedir.status === 429
    ? "RATE LIMIT: a mesa bateu o teto de pedidos por hora. Espere ou use outra mesa."
    : `pedido enviado (2x ${prato.nome})`);
const numeroPedido = pedir.data.pedido?.numero_dia;

// ---------- 3b. sem o passe do cartão, ninguém pede
const semPasse = await fetch(BASE + "/api/food/publico", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ acao: "pedir", token: mesa.token, itens: [{ produto_id: prato.id, qtd: 1 }] }),
});
checa(semPasse.status === 401, "pedir sem o passe da mesa é recusado (401)");

// ---------- 3c. reenvio com a mesma chave não vira pedido em dobro
const chave = "teste-idem-" + Date.now();
const env1 = await api("/api/food/publico", {
  acao: "pedir", token: mesa.token, chave, itens: [{ produto_id: prato.id, qtd: 1 }],
});
const env2 = await api("/api/food/publico", {
  acao: "pedir", token: mesa.token, chave, itens: [{ produto_id: prato.id, qtd: 1 }],
});
checa(env1.data.pedido?.id && env1.data.pedido?.id === env2.data.pedido?.id,
  "reenvio com a mesma chave devolve o MESMO pedido, não um segundo");

// ---------- 4. preço vem do banco, não do navegador
const forjado = await api("/api/food/publico", {
  acao: "pedir", token: mesa.token, deviceId: dev1,
  itens: [{ produto_id: prato.id, qtd: 1, preco: 0.01 }],
});
const totalForjado = Number(forjado.data.pedido?.total ?? 0);
checa(totalForjado === Number(prato.preco), "preço enviado pelo cliente é ignorado (usa o do cardápio)");

// ---------- 5. a cozinha vê
const kdsRes = await fetch(`${BASE}/api/food/kds?token=${kds.token}`, {
  cache: "no-store", headers: cabecalhoCookie("tablet-cozinha"),
});
guardaCookies("tablet-cozinha", kdsRes);
const kdsData = await kdsRes.json();
checa(kdsRes.status === 200, "tablet da cozinha pareia no primeiro acesso");
const meus = (kdsData.itens ?? []).filter((i) => i.pedido_numero === numeroPedido);
checa(meus.length > 0,
  `a cozinha recebeu o pedido #${numeroPedido} (fila com ${(kdsData.itens ?? []).length} item(ns), ` +
  `numeros: ${[...new Set((kdsData.itens ?? []).map((i) => i.pedido_numero))].join(",")})`);

// ---------- 6. a impressora pega a comanda (protocolo CloudPRNT)
const pergunta = await fetch(`${BASE}/api/food/print/${impressora.chave}`, { method: "POST" });
const respostaImpressora = await pergunta.json();
checa(respostaImpressora.jobReady === true, "impressora pergunta e o servidor diz que tem comanda");
const papel = await fetch(`${BASE}/api/food/print/${impressora.chave}`).then((r) => r.text());
checa(papel.includes(prato.nome.split(" ")[0]) && papel.includes("MESA"),
  "texto da comanda saiu com o item e a mesa");
await fetch(`${BASE}/api/food/print/${impressora.chave}`, { method: "DELETE" });
// a fila pode ter comanda de outro pedido; o que não pode é a MESMA sair de novo
const repetida = (await db.query(
  `SELECT COUNT(*)::int AS n FROM food_print_jobs j
     JOIN food_pedidos p ON p.id = j.pedido_id
    WHERE p.loja_id = $1 AND p.numero_dia = $2 AND p.dia = food_dia_loja(p.loja_id)
      AND j.status = 'pendente'`, [loja.id, numeroPedido])).rows[0].n;
const totalDoPedido = (await db.query(
  `SELECT COUNT(*)::int AS n FROM food_print_jobs j
     JOIN food_pedidos p ON p.id = j.pedido_id
    WHERE p.loja_id = $1 AND p.numero_dia = $2 AND p.dia = food_dia_loja(p.loja_id)`,
  [loja.id, numeroPedido])).rows[0].n;
checa(repetida === 0 && totalDoPedido === 1, "a mesma comanda não sai duas vezes (1 via por pedido)");

// ---------- 7. cozinha marca pronto
for (const i of meus) {
  // sem token na URL: agora quem autoriza e o aparelho pareado (cookie)
  await api("/api/food/kds", { acao: "item", itemId: i.id, status: "pronto" }, "tablet-cozinha");
}
const pedidoDepois = (await db.query(
  "SELECT status FROM food_pedidos WHERE loja_id=$1 AND numero_dia=$2 AND dia=food_dia_loja(loja_id)",
  [loja.id, numeroPedido])).rows[0];
checa(pedidoDepois?.status === "pronto", "pedido vira pronto quando a cozinha termina");

// ---------- 7b. o link do tablet morre depois de parear
const linkUsado = await fetch(`${BASE}/api/food/kds?token=${kds.token}`, { cache: "no-store" });
const corpoUsado = await linkUsado.json().catch(() => ({}));
checa(linkUsado.status === 404 && corpoUsado.motivo === "link_ja_usado",
  "o link do tablet nao serve mais depois que o aparelho pareou");

// ---------- 8. o cliente vê a comanda atualizada
const resumo = await api("/api/food/publico", { acao: "resumo", token: mesa.token });
const consumo = (resumo.data.pedidos ?? []).flatMap((p) => p.itens)
  .reduce((s, i) => s + Number(i.preco_total), 0);
// 2 do primeiro pedido + 1 do teste de preco forjado + 1 do teste de chave
checa(consumo === Number(prato.preco) * 4, `comanda do cliente soma certo (${consumo.toFixed(2)})`);

// ---------- 9. chamar garçom e pedir a conta
await api("/api/food/publico", { acao: "chamar", token: mesa.token, tipo: "conta" });
const chamados = (await db.query(
  "SELECT tipo FROM food_chamados WHERE mesa_id=$1 AND status='aberto'", [mesa.id])).rows;
checa(chamados.some((c) => c.tipo === "conta"), "pedido de conta chega para o salão");

// ---------- 10. garçom entra com PIN, e o PIN passa a valer de verdade
// O tablet do garçom é o pote "tablet": o turno vem em cookie httpOnly, igual
// ao navegador do aparelho.
const abriuGarcom = await fetch(`${BASE}/api/food/garcom?token=${garcomTablet.token}`, {
  cache: "no-store", headers: cabecalhoCookie("tablet"),
});
guardaCookies("tablet", abriuGarcom);
checa(abriuGarcom.status === 200, "tablet do garcom pareia ao abrir a tela");

const semTurno = await api("/api/food/garcom", {
  token: garcomTablet.token, acao: "pagamento", mesaId: mesa.id, metodo: "pix", valor: 1,
}, "tablet");
checa(semTurno.status === 401, "sem turno aberto, o tablet não recebe pagamento (401)");

const pinErrado = await api("/api/food/garcom",
  { token: garcomTablet.token, acao: "pin", equipeId: equipe.id, pin: "9999" }, "tablet");
checa(pinErrado.status === 403, "PIN errado não entra");

const pin = await api("/api/food/garcom",
  { token: garcomTablet.token, acao: "pin", equipeId: equipe.id, pin: "1234" }, "tablet");
checa(pin.data.ok === true && !!pin.data.garcom?.papel, "garçom entra com o PIN e abre turno");

const sessao = (await db.query(
  "SELECT id, total FROM food_sessoes WHERE mesa_id=$1 AND status <> 'fechada' ORDER BY aberta_em DESC LIMIT 1",
  [mesa.id])).rows[0];

// cortesia é do gerente: garçom não passa
const cortesia = await api("/api/food/garcom", {
  token: garcomTablet.token, acao: "pagamento", mesaId: mesa.id, metodo: "cortesia", valor: 10,
}, "tablet");
checa(cortesia.status === 403 || pin.data.garcom?.papel === "gerente",
  "cortesia é recusada para quem não é gerente");

await api("/api/food/garcom", {
  token: garcomTablet.token, acao: "pagamento", mesaId: mesa.id,
  metodo: "pix", valor: Number(sessao.total),
}, "tablet");
await api("/api/food/garcom",
  { token: garcomTablet.token, acao: "fechar", mesaId: mesa.id }, "tablet");
const fechada = (await db.query("SELECT status, pago, total FROM food_sessoes WHERE id=$1", [sessao.id])).rows[0];
checa(fechada.status === "fechada" && Number(fechada.pago) >= Number(fechada.total) - 0.01,
  `mesa fechada e paga (total ${fechada.total}, pago ${fechada.pago})`);

// o turno ficou registrado, com nome e hora
const turno = (await db.query(
  "SELECT t.id, e.nome FROM food_turnos t JOIN food_equipe e ON e.id = t.equipe_id WHERE t.equipe_id = $1 ORDER BY t.aberto_em DESC LIMIT 1",
  [equipe.id])).rows[0];
checa(!!turno, `turno aberto e registrado no nome de ${turno?.nome ?? "?"}`);

// ---------- 11. a mesa fica livre para o próximo
const livre = await api("/api/food/publico", { acao: "entrar", token: mesa.token, deviceId: "teste-celular-3" });
checa(livre.data.sessao?.id !== sessao.id && livre.data.novaSessao === true,
  "próximo cliente senta e abre comanda nova");
await db.query("UPDATE food_sessoes SET status='cancelada' WHERE id=$1", [livre.data.sessao.id]);

// ---------- 12. pedido de delivery pelo link
const delivery = await api("/api/food/publico", {
  acao: "pedido_delivery", slug: loja.slug, nome: "Cliente de Teste",
  telefone: "49999998888", bairroId: bairro.id, rua: "Rua Teste", numero: "100",
  pagamento: "pix", itens: [{ produto_id: prato.id, qtd: 1 }],
});
checa(delivery.data.ok === true,
  `pedido de delivery entrou (total ${delivery.data.total}, com taxa do bairro ${bairro.nome})`);
checa(Number(delivery.data.total) === Number(prato.preco) + Number(bairro.taxa),
  "taxa do bairro entrou no total pelo valor cadastrado");

const pedDelivery = (await db.query(
  "SELECT status FROM food_pedidos WHERE loja_id=$1 AND canal='delivery' ORDER BY criado_em DESC LIMIT 1",
  [loja.id])).rows[0];
checa(pedDelivery.status === "pendente", "pedido online espera a loja aceitar antes de ir para a cozinha");

// ---------- 13. o cliente virou cadastro para o CRM
const cli = (await db.query(
  "SELECT nome, optin_whats FROM food_clientes WHERE negocio_id=$1 AND telefone='49999998888'",
  [loja.negocio_id])).rows[0];
checa(!!cli && cli.optin_whats === true, "cliente do delivery entrou na base com opt-in");

// ---------- 14. e gerou evento para o WhatsApp
const evento = (await db.query(
  `SELECT tipo FROM food_eventos WHERE negocio_id=$1 AND processado_em IS NULL
    ORDER BY criado_em DESC LIMIT 1`, [loja.negocio_id])).rows[0];
checa(!!evento, `fila de avisos tem evento pendente (${evento?.tipo})`);

// ---------- 15. cardápio público e pedido online respondem
const vitrine = await fetch(`${BASE}/c/${loja.slug}`).then((r) => r.status);
const online = await fetch(`${BASE}/c/${loja.slug}/pedir`).then((r) => r.status);
const mesaPagina = await fetch(`${BASE}/c/${loja.slug}/m/${mesa.token}`).then((r) => r.status);
checa(vitrine === 200 && online === 200 && mesaPagina === 200, "as três páginas públicas abrem");

const painelSemLogin = await fetch(`${BASE}/food/${loja.negocio_id}`, { redirect: "manual" });
checa(painelSemLogin.status === 307 || painelSemLogin.status === 302,
  "painel do dono exige login (manda para /login)");

// devolve a demonstração como estava: horário no automático e tablets prontos
// para parear de novo
await devolverHorario();
await prepararTablets(24 * 30);
await db.end();

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
