import { redirect } from "next/navigation";
import PageHead from "@/components/page-head";
import NovoClienteModal from "@/components/novo-cliente-modal";
import ClientesTable from "@/components/clientes-table";
import { listHubs, listNegocios } from "@/lib/data";
import { hubOpId } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const hub = await hubOpId();
  if (!hub) redirect("/owner");
  const [hubs, clientes] = await Promise.all([listHubs(), listNegocios(hub)]);
  const hubsMin = hubs.map((h) => ({ id: h.id, nome: h.nome }));

  return (
    <>
      <PageHead
        eyebrow="Usuários"
        titulo="Clientes"
        sub="Gestão de CRM operacional e ecossistema de organizações."
        acao={<NovoClienteModal hubs={hubs} />}
      />

      {ok && (
        <div className="owner-banner" style={{ borderRadius: 12, marginBottom: 16 }}>
          Cliente cadastrado com sucesso.
        </div>
      )}

      <ClientesTable clientes={clientes} hubs={hubsMin} />
    </>
  );
}
