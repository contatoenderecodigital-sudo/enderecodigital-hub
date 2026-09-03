import KdsApp from "@/components/food/kds-app";

// Tela da cozinha. O tablet abre este link uma vez e nunca mais sai dele.
export const dynamic = "force-dynamic";
export const metadata = { title: "Cozinha", robots: { index: false, follow: false } };

export default async function PaginaKds({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <KdsApp token={token} />;
}
