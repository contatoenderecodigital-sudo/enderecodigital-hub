import { redirect } from "next/navigation";
import CriarLoja from "@/components/food/criar-loja";
import PainelSalao from "@/components/food/painel-salao";
import { foodHabilitado, negocioPermitido } from "@/lib/food-auth";
import { lojaPrincipal } from "@/lib/food";

// Painel do restaurante dentro do hub: /food/<negocio_id>
export const dynamic = "force-dynamic";

export default async function PaginaFood({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  if (!(await negocioPermitido(neg))) redirect("/login");

  if (!(await foodHabilitado(neg))) {
    return (
      <Aviso titulo="Restaurante">
        O módulo não está ligado para este cliente. Ligue em Clientes, no console do owner.
      </Aviso>
    );
  }
  if (!(await lojaPrincipal(neg))) return <CriarLoja neg={neg} />;
  return <PainelSalao neg={neg} />;
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 40, color: "#e5e7eb" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{titulo}</h1>
      <p style={{ color: "#9ca3af" }}>{children}</p>
    </div>
  );
}
