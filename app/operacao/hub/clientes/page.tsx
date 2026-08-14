import { redirect } from "next/navigation";
import { listHubs, listNegocios } from "@/lib/data";
import { hubOpId } from "@/lib/hub-ctx";
import ClientesHub from "@/components/groow/hub/clientes-hub";

export const dynamic = "force-dynamic";

export default async function HubClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const hub = await hubOpId();
  if (!hub) redirect("/owner");
  const [hubs, clientes] = await Promise.all([listHubs(), listNegocios(hub)]);
  const hubsMin = hubs.map((h) => ({ id: h.id, nome: h.nome, slug: h.slug }));

  return (
    <>
      {ok && (
        <div style={{ background: "rgba(52,199,89,0.10)", border: "1px solid rgba(52,199,89,0.25)", color: "#1d8a3a", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          Cliente cadastrado com sucesso.
        </div>
      )}
      <ClientesHub clientes={clientes} hubs={hubsMin} />
    </>
  );
}
