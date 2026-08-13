import PageHead from "@/components/page-head";
import ProspeccaoClient from "./prospeccao-client";

export const dynamic = "force-dynamic";

export default function ProspeccaoPage() {
  const temChave = !!process.env.GOOGLE_PLACES_API_KEY;
  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Prospecção"
        sub="Busca empresas no Google Maps por nicho e cidade, pontua cada uma e joga as melhores direto no funil de Leads."
      />
      {!temChave && (
        <div className="err" style={{ marginBottom: 16 }}>
          Falta a <strong>GOOGLE_PLACES_API_KEY</strong> no servidor. Sem ela a busca não roda.
        </div>
      )}
      <ProspeccaoClient />
    </>
  );
}
