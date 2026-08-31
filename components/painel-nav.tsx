"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/link";

// ============================================================================
//  NAV DO PAINEL · a barra lateral do workspace do cliente
//
//  Cliente por causa de uma coisa só: saber em qual página você está. O layout
//  é servidor e não enxerga a rota atual, e barra sem item aceso faz a pessoa
//  clicar de novo no que já está aberto.
//
//  O item ativo é por prefixo, menos a Visão geral. Sem essa exceção, /painel
//  ficaria aceso junto com /painel/veiculos, porque um é prefixo do outro.
// ============================================================================

export type ItemNav = { chave: string; rotulo: string; href: string };

export default function PainelNav({ itens }: { itens: ItemNav[] }) {
  const caminho = usePathname();

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {itens.map((m) => {
        const ativo = m.href === "/painel" ? caminho === "/painel" : caminho.startsWith(m.href);
        return (
          <Link
            key={m.chave}
            href={m.href}
            aria-current={ativo ? "page" : undefined}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              fontSize: 14,
              textDecoration: "none",
              color: ativo ? "var(--text)" : "var(--muted-2)",
              background: ativo ? "rgba(255,255,255,0.07)" : "transparent",
              fontWeight: ativo ? 600 : 400,
            }}
          >
            {m.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
