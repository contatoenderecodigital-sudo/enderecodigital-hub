// IndexNow: notifica Bing/Yandex/Naver (e por tabela o Copilot) na hora que
// uma URL é publicada ou atualizada, sem esperar recrawl. Google não usa,
// mas o custo é zero e o alcance é grátis. Melhor esforço: falha em silêncio.

import { SITE_PUBLICO } from "./constants";

export const INDEXNOW_CHAVE = "e1f47c2b9a8d4063b5c7d92e6f1a3b84";

// host/keyLocation vêm do site PÚBLICO, não do domínio do painel: o IndexNow
// só aceita URLs do host que hospeda o arquivo da chave, e quem tem o
// e1f4....txt na raiz é o site indexado.
const HOST_PUBLICO = SITE_PUBLICO.replace(/^https?:\/\//, "");

export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST_PUBLICO,
        key: INDEXNOW_CHAVE,
        keyLocation: `${SITE_PUBLICO}/${INDEXNOW_CHAVE}.txt`,
        urlList: urls.slice(0, 100),
      }),
    });
  } catch { /* nunca pode derrubar a publicação */ }
}
