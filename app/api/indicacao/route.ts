import { NextResponse } from "next/server";
import { excedeuLimite, ipDoRequest, respostaLimite } from "@/lib/groow/ratelimit";
import {
  getParceiroPorCodigo,
  salvarLeadDoParceiro,
  normalizarTelefone,
} from "@/lib/groow/parceiros";
import { linkWhatsApp } from "@/lib/groow/indicacao";

export const dynamic = "force-dynamic";

// Formulário público da landing de indicação: 5 envios por IP a cada 10 min.
const LIMITE = { max: 5, janelaSeg: 600 };

export async function POST(req: Request) {
  if (excedeuLimite(`indicacao:${ipDoRequest(req)}`, LIMITE)) {
    return respostaLimite(LIMITE.janelaSeg);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const codigo = String(body.codigo || "").toLowerCase();
  const parceiro = await getParceiroPorCodigo(codigo);
  if (!parceiro) {
    return NextResponse.json({ error: "Link de indicação inválido." }, { status: 404 });
  }

  const nome = String(body.nome || "").trim();
  const telefone = normalizarTelefone(String(body.telefone || ""));
  if (!nome || !telefone) {
    return NextResponse.json(
      { error: "Informe o nome e um WhatsApp com DDD." },
      { status: 400 }
    );
  }

  try {
    await salvarLeadDoParceiro(parceiro.id, {
      nome,
      empresa: String(body.empresa || "").trim() || null,
      telefone,
      email: String(body.email || "").trim() || null,
      cidade: String(body.cidade || "").trim() || null,
      setor: String(body.setor || "").trim() || null,
      // Quem preencheu o formulário se cadastrou sozinho: isso é opt-in de
      // verdade, com prova de origem, e vale para a janela da Meta.
      situacao: "autorizou",
      optin: true,
      optin_origem: "landing",
      optin_prova: `Preencheu o formulário em /p/${codigo} pedindo contato.`,
      // Nas palavras dela. E o campo que da a conversa da reuniao, entao entra
      // cru, sem a gente reescrever.
      observacao: String(body.dor || "").trim().slice(0, 2000) || null,
    });
  } catch (err) {
    console.error("[indicacao] falha ao gravar lead:", err);
    return NextResponse.json({ error: "Não consegui registrar agora." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    whatsapp: linkWhatsApp(parceiro.codigo, parceiro.nome),
  });
}
