import { redirect } from "next/navigation";
import FoodNav from "@/components/food/food-nav";
import { lojaPrincipal } from "@/lib/food";
import { negocioPermitido } from "@/lib/food-auth";
import "@/app/food-theme.css";

// Casca do painel do restaurante. Tema proprio (claro, vermelho), porque este e
// o sistema do CLIENTE, nao a marca da Endereco Digital.
// O guard fica aqui: nenhuma tela filha carrega sem passar por negocioPermitido().

export const dynamic = "force-dynamic";

export default async function FoodLayout({
  children, params,
}: {
  children: React.ReactNode;
  params: Promise<{ neg: string }>;
}) {
  const { neg } = await params;
  if (!(await negocioPermitido(neg))) redirect("/login");
  const loja = await lojaPrincipal(neg);

  return (
    <div className="food-app">
      <div className="ws">
        <FoodNav neg={neg} loja={loja?.nome ?? null} />
        <div className="ws-content">{children}</div>
      </div>
    </div>
  );
}
