import { notFound } from "next/navigation";
import MesaApp from "@/components/food/mesa-app";
import { getMesaByToken } from "@/lib/food";

// A URL gravada no cartão NFC (e no QR impresso na mesma peça):
//   https://<host>/c/<slug-da-loja>/m/<token-da-mesa>
// O slug é só para o link ficar legível; quem manda é o token.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const alvo = await getMesaByToken(token);
  return {
    title: alvo ? `${alvo.loja.nome} · Mesa ${alvo.mesa.numero}` : "Cardápio",
    robots: { index: false, follow: false },
  };
}

export default async function PaginaMesa({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const alvo = await getMesaByToken(token);
  if (!alvo || alvo.loja.slug !== slug) notFound();
  return <MesaApp token={token} />;
}
