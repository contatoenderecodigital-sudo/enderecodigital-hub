/**
 * Cidade digitada -> coordenada, para o mapa da prospecção centralizar.
 *
 * Usa o Places que a prospecção já usa, em vez de trazer um segundo provedor
 * de geocodificação só pra isso: uma chave a menos pra manter viva.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Lugar {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export async function POST(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  let body: { cidade?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cidade = (body.cidade || "").trim();
  if (cidade.length < 2) {
    return NextResponse.json({ error: "Digite a cidade." }, { status: 400 });
  }

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
      return NextResponse.json(
        { error: `Google Places retornou ${resp.status}.` },
        { status: 502 }
      );
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

    if (!opcoes.length) {
      return NextResponse.json({ error: "Não achei essa cidade." }, { status: 404 });
    }
    return NextResponse.json({ opcoes });
  } catch (err) {
    console.error("[geocodificar]", err);
    return NextResponse.json({ error: "Falha ao buscar a cidade." }, { status: 500 });
  }
}
