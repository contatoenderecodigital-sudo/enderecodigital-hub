/**
 * Link para abrir a empresa no Google, para o parceiro olhar o perfil antes de
 * discar: foto, avaliacoes, se tem site, se responde.
 *
 * Manda para o Maps e nao para a busca comum de proposito. E o perfil do Google
 * Meu Negocio que a checagem pede, e a busca comum abre uma pagina cheia de
 * concorrente que ele tem que filtrar no olho.
 *
 * Com place_id, abre a ficha exata daquela empresa, sem risco de cair na
 * homonima da cidade vizinha. Sem place_id, cai na busca por nome e cidade, que
 * e o que da para fazer: parceiro_leads nao guarda place_id.
 */
export function linkGoogleMaps(alvo: {
  nome?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  placeId?: string | null;
}): string {
  const pid = String(alvo.placeId || "").trim();
  if (pid) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(pid)}`;
  }
  const termo = [alvo.empresa || alvo.nome, alvo.cidade]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(termo)}`;
}
