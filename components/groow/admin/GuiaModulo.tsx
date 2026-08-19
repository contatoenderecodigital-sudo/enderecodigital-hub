"use client";

// Botão flutuante "Como usar" presente em todo o admin: abre o guia rápido
// do módulo da página atual. Conteúdo 100% local (sem custo, sem rede).
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";

interface Guia {
  prefixo: string;   // rota do módulo (match por prefixo; "/operacao" só exato)
  titulo: string;
  resumo: string;
  passos: string[];
  dica?: string;
}

const GUIAS: Guia[] = [
  {
    prefixo: "/operacao/leads",
    titulo: "Leads",
    resumo: "Todo mundo que levantou a mão: formulário do site, quiz, diagnóstico e importados da Prospecção.",
    passos: [
      "Clique num lead pra abrir os detalhes e o histórico.",
      "Troque o status conforme a conversa avança (novo, em contato, proposta, fechado, recusado).",
      "Os campos origem e fonte de tráfego mostram de onde o lead veio; é isso que alimenta o Tráfego/ROAS.",
      "Lead fechado vira cliente na aba Clientes.",
    ],
    dica: "Responda lead novo em minutos: a chance de fechar cai a cada hora que passa.",
  },
  {
    prefixo: "/operacao/pipeline",
    titulo: "Pipeline",
    resumo: "O funil de vendas em kanban: cada card é um lead caminhando até o fechamento.",
    passos: [
      "Arraste o card de uma coluna pra outra conforme a negociação evolui.",
      "Clique no card pra ver detalhes e anotar o que foi combinado.",
      "Coluna parada por dias é sinal de follow-up esquecido: manda mensagem hoje.",
    ],
  },
  {
    prefixo: "/operacao/clientes",
    titulo: "Clientes",
    resumo: "Quem já fechou contigo: contratos, valores e situação de cada um.",
    passos: [
      "Cadastre o cliente com o valor mensal do contrato (alimenta o Financeiro).",
      "Use os detalhes pra guardar informações do projeto (site, redes, acessos combinados).",
    ],
  },
  {
    prefixo: "/operacao/parceiros",
    titulo: "Parceiros",
    resumo:
      "Quem faz call fria e ganha percentual quando o indicado dele fecha contrato. Cada parceiro tem link próprio, painel próprio e extrato de comissão.",
    passos: [
      "Cadastre o parceiro com e-mail, senha inicial e os percentuais de implantação e mensalidade.",
      "Mande pra ele o link /p/codigo: quem entrar por ali e pedir diagnóstico já nasce na conta dele.",
      "Na ficha do parceiro, os leads da call fria aparecem na fila. Só dispara quem tem autorização com prova.",
      "Disparar promove o lead pra operação, manda o template aprovado e abre a conversa no inbox.",
      "Apurar mês gera as comissões dos contratos fechados. Depois aprove e marque como pago.",
    ],
    dica: "A comissão nasce do contrato, não do lead. Sem cliente cadastrado com valor e data de início, não há o que apurar.",
  },
  {
    prefixo: "/operacao/tarefas",
    titulo: "Tarefas",
    resumo: "Teu quadro de pendências do dia a dia da operação.",
    passos: [
      "Crie a tarefa com prazo; marque como feita quando concluir.",
      "Comece o dia por aqui: o que tem prazo hoje vem primeiro.",
    ],
  },
  {
    prefixo: "/operacao/conversas",
    titulo: "Conversas",
    resumo: "O WhatsApp oficial da agência num inbox só: a IA responde primeiro e você assume quando quiser. Dá pra iniciar conversa você mesmo puxando o contato de Leads ou Clientes.",
    passos: [
      "Nova conversa: clique no botão azul, busque o contato em Leads/Clientes (ou digite o número na mão) e dispare a primeira mensagem.",
      "Regra da Meta: pra falar com quem NÃO te mandou mensagem nas últimas 24h, só com template aprovado (o modal já mostra os seus). Texto livre só quando o contato te chamou faz menos de 24h.",
      "Deixe marcado 'IA conduz' pra IA assumir quando o contato responder; desmarque se quiser conversar você mesmo.",
      "Numa conversa aberta: Assumir pausa a IA e passa o teclado pra você; Devolver pra IA volta o controle; Fechar arquiva.",
      "Escrever uma mensagem numa conversa com IA ativa já assume o atendimento automaticamente.",
    ],
    dica: "Sem template aprovado ainda? Crie um de categoria Utilidade no Gerenciador do WhatsApp; costuma aprovar em minutos e libera o primeiro contato com qualquer número.",
  },
  {
    prefixo: "/operacao/disparos",
    titulo: "Disparos",
    resumo: "Campanhas de WhatsApp em massa com template aprovado pela Meta.",
    passos: [
      "Crie a campanha escolhendo um template aprovado e suba o CSV de destinatários (whatsapp,nome).",
      "Defina a cadência: máximo por dia, janela de horário e pular domingo.",
      "Confirme o opt-in LGPD antes de iniciar: só dispare pra quem tem relação com o negócio.",
      "A campanha nasce como rascunho; inicie por aqui ou pela central de Aprovações.",
      "Quem responder SAIR entra na lista de opt-out e nunca mais recebe.",
    ],
    dica: "A Prospecção tem o botão Criar disparo que já monta o CSV pra você.",
  },
  {
    prefixo: "/operacao/prospeccao",
    titulo: "Prospecção",
    resumo: "Máquina de achar cliente: busca negócios no Google, dá nota de oportunidade e conecta com Disparos e Email.",
    passos: [
      "Escolha o nicho (ou navegue nos 123) e a cidade, e clique em Buscar.",
      "O score 0-100 rankeia a oportunidade: sem site próprio + bem avaliado + com telefone = alvo quente.",
      "Clique em Escanear sites: marca site fora do ar (oportunidade extra) e garimpa o email de contato de cada um.",
      "Selecione os melhores e escolha a saída: Importar como leads, Criar disparo (WhatsApp) ou Email.",
      "No Email, clique em Escrever com IA: ela monta o texto do nicho com {{nome}} personalizado; quem recebeu nos últimos 30 dias é pulado automaticamente.",
    ],
    dica: "Filtro Sem site próprio + score 70+ é a lista de ouro pra oferecer site.",
  },
  {
    prefixo: "/operacao/trafego",
    titulo: "Tráfego",
    resumo: "Monta URLs com UTM e cruza origem dos leads com gasto de anúncio pra ver o retorno por canal.",
    passos: [
      "Use o UTM Builder pra gerar o link de cada anúncio ou bio (fonte, campanha).",
      "Os leads que chegarem por esses links já entram marcados com a fonte.",
      "Com as envs da Meta configuradas, o gasto das campanhas entra sozinho e o ROAS aparece por canal.",
    ],
  },
  {
    prefixo: "/operacao/mapa",
    titulo: "Mapa do Ecossistema",
    resumo: "Canvas visual da operação do cliente: ferramenta de venda pra ele VER a máquina que está comprando.",
    passos: [
      "Novo mapa já nasce com o ecossistema padrão (anúncio, site, WhatsApp com IA, pipeline); adapte pro cliente.",
      "Adicionar bloco: use os botões Canal, Etapa, Ferramenta e Nota no topo. Arraste os blocos pra posicionar.",
      "Renomear: dê duplo clique no bloco e digite; Enter confirma. Também dá pra editar no paininho que abre embaixo quando um bloco está selecionado (lá troca o tipo também).",
      "Excluir: selecione o bloco e aperte Delete (ou o ícone de lixeira no paininho). Pra apagar uma seta, clique no meio dela.",
      "Ligar: clique em Ligar, depois no bloco de origem e no de destino pra criar a seta.",
      "Navegar e dar zoom: arraste o fundo pra mover; scroll do mouse navega; Ctrl + scroll (ou Ctrl +/- no teclado) dá zoom; Ctrl 0 recentraliza. Os botões de lupa no topo fazem o mesmo.",
      "Salva sozinho: cada mudança (renomear, mover, ligar, o próprio nome do mapa lá em cima) grava automático 1 segundo depois. O botão Salvar continua ali como reforço, mas o normal é nem precisar clicar.",
      "Copie o Link do cliente: página pública só-leitura, com CTA pro diagnóstico no topo. Use na reunião de fechamento, desenhando o ecossistema DO cliente na frente dele.",
    ],
    dica: "Um mapa por proposta, com o nome do negócio do cliente no título, fecha mais que PDF.",
  },
  {
    prefixo: "/operacao/metricas",
    titulo: "Métricas",
    resumo: "Os números da operação: leads por período, origem e evolução.",
    passos: [
      "Acompanhe semanalmente: qual origem trouxe mais lead e qual converteu melhor.",
      "Use junto com o Tráfego pra decidir onde investir mais.",
    ],
  },
  {
    prefixo: "/operacao/blog",
    titulo: "Blog SEO",
    resumo: "A IA escreve artigo otimizado seguindo as diretrizes do Google; você aprova e o Google indexa.",
    passos: [
      "Todo dia às 6h30 o agente pesquisa o que empreendedor está buscando e deixa um artigo pronto como rascunho.",
      "Pra gerar na hora: Gerar artigo com IA, no automático (ela escolhe o tema) ou com tema seu.",
      "Clique em Revisar pra ler; Aprovar publica na hora e o artigo entra no sitemap sozinho.",
      "O custo em reais de cada geração aparece no card do artigo.",
      "Máximo de 3 rascunhos pendentes: aprove ou descarte pra fila andar.",
    ],
    dica: "Publique com constância: 1 artigo aprovado por dia é o que constrói autoridade no Google.",
  },
  {
    prefixo: "/operacao/conteudo-social",
    titulo: "Conteúdo Social",
    resumo: "Pauta e conteúdo de Instagram gerados por IA: reels com roteiro e carrosséis prontos pra baixar.",
    passos: [
      "Gere a pauta: a IA cria ideias com hook forte distribuídas nos 4 pilares da marca.",
      "Gerar conteúdo (no card) cria UMA ideia; Gerar 3 em lote pega as 3 próximas ideias novas e cria em fila. Cada conteúdo leva de 30 a 60 segundos, o cronômetro mostra o andamento.",
      "No carrossel, os slides saem no visual do kit premium da casa; o botão Prompt copia o texto pra gerar a foto no Google Labs e o clique no slide encaixa a imagem baixada.",
      "Baixe os PNGs prontos e poste. A legenda sai na fórmula da casa (hook, contexto, uma ação, hashtags de nicho); é copiar e colar.",
    ],
  },
  {
    prefixo: "/operacao/aprovacoes",
    titulo: "Aprovações",
    resumo: "Central única do que espera teu OK: artigos, conteúdo social e campanhas paradas.",
    passos: [
      "Tudo que a IA gera cai aqui como rascunho; nada é publicado sem você.",
      "Publicar coloca o artigo no ar na hora; o X descarta.",
      "Campanha de disparo em rascunho pode ser iniciada direto daqui.",
    ],
    dica: "Abra essa aba todo dia de manhã: é a caixa de entrada da tua operação.",
  },
  {
    prefixo: "/operacao/ia",
    titulo: "IA & Custos",
    resumo: "O diário de bordo da IA: toda geração (blog, social, email) registrada com tokens, tempo, custo em reais e status.",
    passos: [
      "Os cards mostram o gasto de hoje, dos últimos 30 dias e a quantidade de chamadas.",
      "A tabela lista cada chamada: o que a IA fez, tokens de entrada e saída, buscas web, duração e custo.",
      "Erro em vermelho indica chamada que falhou (o custo dela é zero ou parcial); se repetir muito, me avisa.",
      "O custo também aparece no card de cada artigo e conteúdo social nas abas deles.",
    ],
    dica: "Referência de custo saudável: artigo completo com pesquisa entre R$ 0,20 e R$ 0,40. Muito acima disso, investigar.",
  },
  {
    prefixo: "/operacao/relatorios",
    titulo: "Relatórios",
    resumo: "Relatório mensal white-label por cliente: números, o que foi feito e próximos passos num link bonito com a tua marca.",
    passos: [
      "Novo relatório: escolha o cliente e o mês.",
      "Preencha o resumo, os números (com variação vs mês anterior), o que foi feito e os próximos passos.",
      "Salve e copie o Link do cliente: página pública com capa navy, cards de métricas e checklist.",
      "Manda no WhatsApp do cliente todo fim de mês. Cliente que VÊ o trabalho renova sem choro.",
    ],
    dica: "Quando as envs da Meta chegarem, os números de anúncio poderão ser puxados automáticos.",
  },
  {
    prefixo: "/operacao/funil",
    titulo: "Funil & Performance",
    resumo: "Raio-x do caminho do lead: onde trava, quanto converte e qual origem realmente fecha negócio.",
    passos: [
      "Escolha o período (30 dias, 90 dias ou tudo).",
      "O funil mostra quantos leads chegam em cada etapa e o percentual que avança entre elas.",
      "A tabela por origem revela qual canal traz lead que FECHA (não só volume).",
      "O gráfico de 6 meses mostra a tendência: leads entrando e fechamentos por mês.",
    ],
    dica: "Etapa com queda brusca de avanço é onde tua operação está vazando dinheiro: ataca ela primeiro.",
  },
  {
    prefixo: "/operacao/senhas",
    titulo: "Senhas",
    resumo: "Cofre criptografado (AES-256) das credenciais da agência e dos clientes. A senha nunca fica em texto puro no banco.",
    passos: [
      "Cadastre com o nome do cliente pra agrupar (vazio = acesso interno da agência).",
      "A senha fica escondida na lista; o olho revela por 30 segundos e esconde sozinha.",
      "O botão de copiar manda direto pro clipboard, sem nem precisar revelar.",
      "Precisa da env SENHAS_CHAVE no servidor: é a chave-mestra do cofre. Se ela mudar, as senhas já salvas não abrem mais.",
    ],
    dica: "Guarde a SENHAS_CHAVE também fora do servidor (num lugar seguro): sem ela não existe recuperação.",
  },
  {
    prefixo: "/operacao/financeiro",
    titulo: "Financeiro",
    resumo: "Entradas e saídas da agência num lugar só.",
    passos: [
      "Lance receitas e despesas do mês.",
      "Compare com o mês anterior pra ver a direção do caixa.",
    ],
  },
  {
    prefixo: "/operacao/cobrancas",
    titulo: "Cobranças",
    resumo: "Controle do que cada cliente tem a pagar e o que já venceu.",
    passos: [
      "Cadastre a cobrança com valor e vencimento.",
      "Marque como paga ao receber; atrasadas ficam em destaque pra você cobrar.",
    ],
  },
  {
    prefixo: "/operacao",
    titulo: "Painel",
    resumo: "A visão geral da operação: números do momento e atalhos pros módulos.",
    passos: [
      "Comece o dia por aqui e pela aba Aprovações (o que a IA deixou pronto esperando teu OK).",
      "Cada card do painel leva pro módulo correspondente na barra lateral.",
      "Todo módulo tem este botão Como usar no canto: abre o guia da aba que você estiver.",
    ],
  },
];

function guiaDaRota(pathname: string): Guia | null {
  for (const g of GUIAS) {
    if (g.prefixo === "/operacao") {
      if (pathname === "/operacao") return g;
      continue;
    }
    if (pathname === g.prefixo || pathname.startsWith(g.prefixo + "/")) return g;
  }
  return null;
}

export default function GuiaModulo() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const guia = guiaDaRota(pathname ?? "");
  if (!guia) return null;

  return (
    <>
      <style>{`
        .ed3-guia-btn { position: fixed; bottom: 22px; left: 20px; z-index: 120; }
        @media (min-width: 1024px) { .ed3-guia-btn { left: 260px; } }
      `}</style>

      <button
        type="button"
        className="ed3-guia-btn"
        onClick={() => setAberto(true)}
        title={`Como usar: ${guia.titulo}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "var(--ed2-card)", color: "var(--ed2-ink-2)",
          border: "1px solid var(--ed2-hair)", padding: "8px 14px", borderRadius: 999,
          fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(7,15,38,0.12)",
        }}
      >
        <CircleHelp size={14} style={{ color: "var(--pill-gold-fg)" }} aria-hidden />
        Como usar
      </button>

      {aberto && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(7,15,38,0.45)" }}
          onClick={() => setAberto(false)}
        >
          <aside
            aria-label={`Guia do módulo ${guia.titulo}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0,
              width: "min(420px, 92vw)", background: "var(--ed2-card)",
              boxShadow: "-12px 0 48px rgba(0,0,0,0.25)",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pill-gold-fg)", marginBottom: 4 }}>Como usar</div>
                <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em" }}>{guia.titulo}</div>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar guia" style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", padding: 6 }}>
                <X size={18} aria-hidden />
              </button>
            </div>

            <div style={{ overflowY: "auto", padding: "18px 24px 28px" }}>
              <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "var(--ed2-ink-2)" }}>{guia.resumo}</p>

              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                {guia.passos.map((p, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: "rgba(201,169,97,0.14)", color: "var(--pill-gold-fg)", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 800 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>{p}</span>
                  </li>
                ))}
              </ol>

              {guia.dica && (
                <div style={{ marginTop: 20, background: "rgba(201,169,97,0.10)", borderRadius: 14, padding: "13px 16px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--pill-gold-fg)", marginBottom: 4 }}>Dica</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>{guia.dica}</div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
