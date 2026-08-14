import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

interface EmpresaImport {
  place_id?: string;
  nome: string;
  telefone?: string;
  email?: string;      // garimpado pelo Escanear sites
  site?: string;
  endereco?: string;
  setor?: string;
  semSiteProprio?: boolean;
}

export async function POST(request: Request) {
  let body: { empresas: EmpresaImport[]; setor?: string; cidade?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const empresas = Array.isArray(body.empresas) ? body.empresas : [];
  if (empresas.length === 0) {
    return NextResponse.json({ error: "Nenhuma empresa selecionada." }, { status: 400 });
  }

  // Telefones e place_ids já existentes pra evitar duplicata
  const existentes = await query<{ telefone: string | null; place_id: string | null }>(
    `SELECT telefone, place_id FROM leads`
  );
  const telSet = new Set(
    existentes.map((r) => (r.telefone || "").replace(/\D/g, "")).filter(Boolean)
  );
  const placeSet = new Set(existentes.map((r) => r.place_id).filter(Boolean) as string[]);

  let inseridos = 0;
  let duplicados = 0;

  for (const emp of empresas) {
    if (!emp.nome?.trim()) continue;
    const telDigits = (emp.telefone || "").replace(/\D/g, "");
    // dedup por place_id (confiável) OU telefone
    if (emp.place_id && placeSet.has(emp.place_id)) { duplicados++; continue; }
    if (telDigits && telSet.has(telDigits)) { duplicados++; continue; }

    const temSiteProprio = emp.site && !emp.semSiteProprio ? 1 : 0;
    // nota de oportunidade pra prospecção digital
    const mensagem = emp.semSiteProprio
      ? "Oportunidade: não tem site próprio (só rede social ou nenhum)"
      : null;
    // o modal/disparos usam a coluna whatsapp (dígitos com DDI 55)
    const whatsapp = telDigits ? (telDigits.startsWith("55") && telDigits.length > 11 ? telDigits : `55${telDigits}`) : null;

    try {
      await exec(
        `INSERT INTO leads (nome, empresa, telefone, whatsapp, email, setor, cidade, site, endereco, place_id, tem_site_proprio, mensagem, origem, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prospeccao', 'novo')`,
        [
          emp.nome.trim(),
          emp.nome.trim(),
          emp.telefone || null,
          whatsapp,
          emp.email?.trim() || null,
          body.setor || emp.setor || null,
          body.cidade || null,
          emp.site || null,
          emp.endereco || null,
          emp.place_id || null,
          temSiteProprio,
          mensagem,
        ]
      );
      if (telDigits) telSet.add(telDigits);
      if (emp.place_id) placeSet.add(emp.place_id);
      inseridos++;
    } catch (err) {
      console.error("[prospeccao/importar] insert failed:", err);
    }
  }

  return NextResponse.json({ ok: true, inseridos, duplicados });
}
