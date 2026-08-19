// Blocos JSON-LD compartilhados (achados da auditoria de schema de 2026-07-15).

const BASE = "https://enderecodigital.com";

/** BreadcrumbList de 2 níveis: Início > página. */
export function breadcrumbJsonLd(nome: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: nome, item: `${BASE}${path}` },
    ],
  };
}
