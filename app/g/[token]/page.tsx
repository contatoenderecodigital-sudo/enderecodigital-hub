import GarcomApp from "@/components/food/garcom-app";

// Tablet do garçom. Token do dispositivo na URL, PIN por pessoa.
export const dynamic = "force-dynamic";
export const metadata = { title: "Garçom", robots: { index: false, follow: false } };

export default async function PaginaGarcom({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GarcomApp token={token} />;
}
