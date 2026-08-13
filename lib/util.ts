export function slugify(s: string): string {
  // Remove acentos: decompoe (NFD) e tira os diacriticos combinantes U+0300..U+036F.
  const semAcento = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const base = semAcento
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "item";
}

export function sufixoCurto(): string {
  return Math.random().toString(36).slice(2, 7);
}
