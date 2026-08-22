/**
 * Geometria da busca por raio da prospecção.
 *
 * O Places (New) restringe searchText por RETÂNGULO, não por círculo. Então a
 * conta é em duas etapas: manda o retângulo que envolve o círculo, para o
 * Google já filtrar do lado dele, e depois corta pela distância real, senão o
 * resultado sairia quadrado em vez de redondo.
 */

export interface Ponto {
  lat: number;
  lng: number;
}

const RAIO_TERRA_KM = 6371;

/** Distância em km entre dois pontos (Haversine). */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(s));
}

/**
 * Retângulo que envolve o círculo (centro, raio). A longitude é dividida pelo
 * cosseno da latitude porque um grau de longitude encurta conforme se afasta
 * do equador: sem isso o retângulo sairia estreito demais no sul do Brasil.
 */
export function retanguloDoCirculo(centro: Ponto, raioKm: number) {
  const grausLat = raioKm / 111.32;
  const cos = Math.cos((centro.lat * Math.PI) / 180);
  const grausLng = raioKm / (111.32 * Math.max(0.01, Math.abs(cos)));
  return {
    low: {
      latitude: Math.max(-89.9, centro.lat - grausLat),
      longitude: Math.max(-179.9, centro.lng - grausLng),
    },
    high: {
      latitude: Math.min(89.9, centro.lat + grausLat),
      longitude: Math.min(179.9, centro.lng + grausLng),
    },
  };
}

export const RAIO_MIN_KM = 1;
export const RAIO_MAX_KM = 200;

export function raioValido(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(RAIO_MAX_KM, Math.max(RAIO_MIN_KM, n));
}

export function coordValida(lat: unknown, lng: unknown): Ponto | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}
