import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  businessStatus?: string;
}

/** Considera "sem site próprio" quando não tem site ou é só rede social/agregador/app de agendamento */
function semSiteProprio(site: string): boolean {
  if (!site) return true;
  const s = site.toLowerCase();
  return /instagram\.com|facebook\.com|linktr\.ee|wa\.me|api\.whatsapp|google\.com|goo\.gl|linktree|booksy|appbarber|trinks\.com|agendaboa|sites\.google|negocio\.site|business\.site|beleza\.com|fresha\.com|ifood\.com|anota\.ai|goomer|cardapioweb|whatsapp\.com/.test(s);
}

/**
 * Score de prospect 0-100 (estilo Kaptar, calibrado pro que a Endereço vende):
 * quanto MAIOR, melhor o alvo - negócio saudável, contactável e SEM presença
 * digital própria (a dor que a gente resolve).
 */
function scoreProspect(e: { telefone: string; site: string; semSiteProprio: boolean; rating: number | null; avaliacoes: number; ativo: boolean }): { score: number; motivos: string[] } {
  let s = 0;
  const motivos: string[] = [];

  if (!e.site) { s += 40; motivos.push("sem site nenhum (+40)"); }
  else if (e.semSiteProprio) { s += 32; motivos.push("só rede social, sem site próprio (+32)"); }
  else { motivos.push("já tem site próprio (0)"); }

  if (e.telefone) { s += 20; motivos.push("tem telefone (+20)"); }

  const r = e.rating ?? 0;
  if (r >= 4.5 && e.avaliacoes >= 50) { s += 25; motivos.push(`negócio forte: ${r} com ${e.avaliacoes} avaliações (+25)`); }
  else if (r >= 4.0 && e.avaliacoes >= 20) { s += 17; motivos.push(`bem avaliado: ${r} com ${e.avaliacoes} avaliações (+17)`); }
  else if (e.avaliacoes >= 5) { s += 8; motivos.push("tem movimento no Google (+8)"); }
  else { motivos.push("pouca presença no Google (0)"); }

  if (e.avaliacoes >= 200) { s += 10; motivos.push("volume alto de clientes (+10)"); }

  if (!e.ativo) { s = Math.round(s * 0.3); motivos.push("consta como fechado (score reduzido)"); }

  return { score: Math.max(0, Math.min(100, s)), motivos };
}

export async function POST(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY não configurada no servidor (.env.local)." },
      { status: 500 }
    );
  }

  let body: {
    nicho?: string; cidade?: string; bairro?: string;
    minRating?: number; minReviews?: number;
    onlyPhone?: boolean; semSite?: boolean; maxPaginas?: number;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nicho = (body.nicho || "").trim();
  const cidade = (body.cidade || "").trim();
  const bairro = (body.bairro || "").trim();
  if (!nicho || !cidade) {
    return NextResponse.json({ error: "Informe nicho e cidade." }, { status: 400 });
  }

  const minRating = Number(body.minRating ?? 0);
  const minReviews = Number(body.minReviews ?? 0);
  const onlyPhone = !!body.onlyPhone;
  const semSite = !!body.semSite;
  const maxPaginas = Math.min(3, Math.max(1, Number(body.maxPaginas ?? 1))); // até 60

  const textQuery = bairro ? `${nicho} em ${bairro}, ${cidade}` : `${nicho} em ${cidade}`;
  const fieldMask = [
    "places.id", "places.displayName", "places.nationalPhoneNumber",
    "places.internationalPhoneNumber", "places.websiteUri", "places.rating",
    "places.userRatingCount", "places.formattedAddress", "places.businessStatus",
    "nextPageToken",
  ].join(",");

  try {
    const todas: PlaceResult[] = [];
    let pageToken: string | undefined;

    for (let i = 0; i < maxPaginas; i++) {
      const reqBody: Record<string, unknown> = { textQuery, languageCode: "pt-BR", regionCode: "BR", pageSize: 20 };
      if (pageToken) reqBody.pageToken = pageToken;

      const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask },
        body: JSON.stringify(reqBody),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error("[prospeccao] Places API error:", resp.status, txt);
        if (i === 0) {
          return NextResponse.json(
            { error: `Google Places retornou erro ${resp.status}. Verifique se a chave está válida e a Places API (New) ativada.` },
            { status: 502 }
          );
        }
        break; // já temos resultados da 1ª página
      }

      const data = (await resp.json()) as { places?: PlaceResult[]; nextPageToken?: string };
      todas.push(...(data.places || []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
      // pequena espera pro token ficar válido
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Cruza com leads já no banco (place_id + telefone) pra não re-importar
    const porTelefone = new Map<string, string>();
    const porPlace = new Map<string, string>();
    try {
      const existentes = await query<{ telefone: string | null; place_id: string | null; status: string }>(
        `SELECT telefone, place_id, status FROM leads`
      );
      for (const l of existentes) {
        const d = (l.telefone || "").replace(/\D/g, "");
        if (d) porTelefone.set(d, l.status);
        if (l.place_id) porPlace.set(l.place_id, l.status);
      }
    } catch { /* ignora */ }

    let empresas = todas.map((p) => {
      const site = p.websiteUri || "";
      const telDigits = (p.nationalPhoneNumber || p.internationalPhoneNumber || "").replace(/\D/g, "");
      const statusExistente = porPlace.get(p.id) || porTelefone.get(telDigits) || null;
      const base = {
        place_id: p.id,
        nome: p.displayName?.text || "",
        telefone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
        site,
        rating: p.rating ?? null,
        avaliacoes: p.userRatingCount ?? 0,
        endereco: p.formattedAddress || "",
        ativo: p.businessStatus === "OPERATIONAL",
        semSiteProprio: semSiteProprio(site),
        jaImportado: !!statusExistente,
        statusExistente,
      };
      const q = scoreProspect(base);
      return { ...base, score: q.score, motivos: q.motivos };
    });

    // Aplica filtros e ordena do melhor prospect pro pior
    empresas = empresas
      .filter((e) => {
        if (onlyPhone && !e.telefone) return false;
        if (minRating > 0 && (e.rating ?? 0) < minRating) return false;
        if (minReviews > 0 && e.avaliacoes < minReviews) return false;
        if (semSite && !e.semSiteProprio) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score);

    // filtros zeraram a lista mas a busca ACHOU empresas: avisa em vez de parecer defeito
    const aviso =
      empresas.length === 0 && todas.length > 0
        ? `A busca achou ${todas.length} empresas, mas os filtros cortaram todas. Afrouxa os filtros (nota, avaliações, telefone ou "sem site próprio") e busca de novo.`
        : null;
    return NextResponse.json({ empresas, query: textQuery, totalBruto: todas.length, aviso });
  } catch (err) {
    console.error("[prospeccao] error:", err);
    return NextResponse.json(
      { error: "Não foi possível buscar as empresas." },
      { status: 500 }
    );
  }
}
