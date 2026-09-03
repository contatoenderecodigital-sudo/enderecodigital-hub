"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/link";
import { IcoDashboard, IcoSettings, IcoLogout } from "@/components/icons";
import { IcoCaixa, IcoCardapio, IcoEstoque, IcoMesa, IcoMoto, IcoRelogio, IcoSino } from "./icones";

// Barra do painel do restaurante, no mesmo padrão do workspace do hub.
// Fica em componente cliente só por causa do "aba ativa".

export default function FoodNav({ neg, loja }: { neg: string; loja: string | null }) {
  const caminho = usePathname() || "";
  const abas: [string, string, React.ReactNode][] = [
    ["", "Salão", <IcoDashboard key="a" width={17} height={17} />],
    ["/cardapio", "Cardápio", <IcoCardapio key="b" width={17} height={17} />],
    ["/mesas", "Mesas e cartões", <IcoMesa key="c" width={17} height={17} />],
    ["/delivery", "Delivery", <IcoMoto key="d" width={17} height={17} />],
    ["/caixa", "Caixa", <IcoCaixa key="e" width={17} height={17} />],
    ["/estoque", "Estoque", <IcoEstoque key="f" width={17} height={17} />],
    ["/relatorios", "Relatórios", <IcoRelogio key="h" width={17} height={17} />],
    ["/marketing", "Marketing", <IcoSino key="i" width={17} height={17} />],
    ["/fiscal", "Nota fiscal", <IcoCaixa key="j" width={17} height={17} />],
    ["/config", "Configuração", <IcoSettings key="g" width={17} height={17} />],
  ];

  return (
    <nav className="wsnav">
      <span className="wsnav-logo">
        <span className="avatar">{(loja || "R").slice(0, 1).toUpperCase()}</span>
        <b>{loja || "Restaurante"}</b>
      </span>
      <span className="wsnav-tabs">
        {abas.map(([href, rotulo, icone]) => {
          const alvo = `/food/${neg}${href}`;
          const ativa = href === "" ? caminho === alvo : caminho.startsWith(alvo);
          return (
            <Link key={href} href={alvo} className={"wsnav-tab" + (ativa ? " active" : "")}>
              {icone}
              {rotulo}
            </Link>
          );
        })}
      </span>
      <span className="wsnav-right">
        <Link href="/logout" className="wsnav-tab" title="Sair">
          <IcoLogout width={17} height={17} />
        </Link>
      </span>
    </nav>
  );
}
