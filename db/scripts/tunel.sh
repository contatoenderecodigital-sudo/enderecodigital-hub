#!/usr/bin/env bash
# ============================================================================
#  TUNEL DO BANCO · mantem a porta 5433 de pe
#
#  O Postgres do hub roda na VPS e nao fica exposto na internet. Todo acesso
#  local passa por um tunel SSH, e sem ele nada que fala com o banco funciona:
#  o painel quebra sem dizer o porque.
#
#  POR QUE UM LACO, e nao um ssh solto: o servidor derruba a conexao sozinho de
#  tempos em tempos ("Connection reset by peer"). ServerAliveInterval nao
#  resolve, porque nao e ociosidade, e o reset vem do outro lado. Entao o jeito
#  e reconectar: cai, espera tres segundos, sobe de novo.
#
#  Deixe rodando num terminal separado enquanto estiver trabalhando.
#  Ctrl+C encerra.
#
#  ATENCAO: isto liga no banco de PRODUCAO. Nao e sandbox.
# ============================================================================

CHAVE="${CHAVE_HUB:-$HOME/.ssh/id_ed25519_hub}"
VPS="${VPS_HUB:-root@179.198.126.197}"
DESTINO="${PG_INTERNO:-172.16.1.7:5432}"
PORTA="${PORTA_LOCAL:-5433}"

echo "Tunel do banco · localhost:$PORTA -> $DESTINO"
echo "Ctrl+C encerra."

while true; do
  ssh -i "$CHAVE" -N \
      -o BatchMode=yes \
      -o StrictHostKeyChecking=accept-new \
      -o ExitOnForwardFailure=yes \
      -o ServerAliveInterval=20 \
      -o ServerAliveCountMax=3 \
      -L "$PORTA:$DESTINO" "$VPS"

  codigo=$?
  # Codigo 0 so acontece quando alguem encerrou de proposito.
  if [ $codigo -eq 0 ]; then
    echo "Tunel encerrado."
    break
  fi
  echo "Tunel caiu (codigo $codigo). Reconectando em 3s..."
  sleep 3
done
