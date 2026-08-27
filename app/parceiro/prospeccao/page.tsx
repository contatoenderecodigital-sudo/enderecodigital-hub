"use client";

import TelaProspeccao from "@/components/groow/admin/prospeccao/TelaProspeccao";

// Mesma tela do GROOW OS, sem prévia de site, e-mail e disparo: aquilo sai em
// nome da Endereço Digital e é decisão do dono. E com teto diário de busca,
// porque cada uma é chamada paga da API do Google.
export default function ProspeccaoDoParceiro() {
  return <TelaProspeccao modo="parceiro" />;
}
