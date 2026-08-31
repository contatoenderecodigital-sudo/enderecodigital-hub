/**
 * Cidade digitada -> coordenada, para o mapa da prospeccao centralizar.
 *
 * Usa o Places que a prospeccao ja usa, em vez de trazer um segundo provedor de
 * geocodificacao so pra isso: uma chave a menos pra manter viva.
 *
 * Extraido da rota de admin porque o mapa e o MESMO componente nos dois
 * paineis. Enquanto so a rota de admin existia, o parceiro tomava unauthorized
 * do middleware ao buscar a cidade no mapa.
 */

export interface OpcaoLugar {
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
}

interface Lugar {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export type ResultadoGeo =
  | { ok: true; opcoes: OpcaoLugar[] }
  | { ok: false; status: number; error: string };

export async function geocodificarCidade(cidadeBruta: string): Promise<ResultadoGeo> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return { ok: false, status: 500, error: "GOOGLE_PLACES_API_KEY não configurada no servidor." };
  }

  const cidade = (cidadeBruta || "").trim();
  if (cidade.length < 2) return { ok: false, status: 400, error: "Digite a cidade." };

  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: cidade,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 5,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("[geocodificar] Places", resp.status, txt.slice(0, 300));
      return { ok: false, status: 502, error: `Google Places retornou ${resp.status}.` };
    }

    const data = (await resp.json()) as { places?: Lugar[] };
    const opcoes = (data.places || [])
      .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
      .map((p) => ({
        nome: p.displayName?.text || cidade,
        endereco: p.formattedAddress || "",
        lat: p.location!.latitude as number,
        lng: p.location!.longitude as number,
      }));

    if (!opcoes.length) return { ok: false, status: 404, error: "Não achei essa cidade." };
    return { ok: true, opcoes };
  } catch (err) {
    console.error("[geocodificar]", err);
    return { ok: false, status: 500, error: "Falha ao buscar a cidade." };
  }
}
