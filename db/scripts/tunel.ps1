# ============================================================================
#  TUNEL DO BANCO · mantem a porta 5433 de pe (versao PowerShell)
#
#  Mesma coisa que o tunel.sh, sem depender do Git Bash. O `bash` nao esta no
#  PATH do PowerShell nesta maquina, e o `ssh` do Windows 11 e nativo, entao
#  aqui nao falta nada pra instalar.
#
#  O Postgres do hub roda na VPS e nao fica exposto na internet. Todo acesso
#  local passa por este tunel, e sem ele nada que fala com o banco funciona: o
#  painel quebra sem dizer o porque.
#
#  POR QUE UM LACO, e nao um ssh solto: o servidor derruba a conexao sozinho de
#  tempos em tempos ("Connection reset by peer"). ServerAliveInterval nao
#  resolve, porque nao e ociosidade, o reset vem do outro lado. Entao o jeito e
#  reconectar: cai, espera tres segundos, sobe de novo.
#
#  Deixe rodando numa janela separada enquanto estiver trabalhando.
#  Ctrl+C encerra.
#
#  Uso:  powershell -ExecutionPolicy Bypass -File db\scripts\tunel.ps1
#
#  ATENCAO: isto liga no banco de PRODUCAO. Nao e sandbox.
# ============================================================================

$CHAVE   = if ($env:CHAVE_HUB)  { $env:CHAVE_HUB }  else { "$env:USERPROFILE\.ssh\id_ed25519_hub" }
$VPS     = if ($env:VPS_HUB)    { $env:VPS_HUB }    else { "root@179.198.126.197" }
$DESTINO = if ($env:PG_INTERNO) { $env:PG_INTERNO } else { "172.16.1.7:5432" }
$PORTA   = if ($env:PORTA_LOCAL){ $env:PORTA_LOCAL }else { "5433" }

if (-not (Test-Path $CHAVE)) {
  Write-Host "Chave nao encontrada em $CHAVE" -ForegroundColor Red
  Write-Host "Aponte outra com: `$env:CHAVE_HUB = 'caminho\da\chave'"
  exit 1
}

Write-Host "Tunel do banco · localhost:$PORTA -> $DESTINO"
Write-Host "Ctrl+C encerra."

while ($true) {
  ssh -i $CHAVE -N `
      -o BatchMode=yes `
      -o StrictHostKeyChecking=accept-new `
      -o ExitOnForwardFailure=yes `
      -o ServerAliveInterval=20 `
      -o ServerAliveCountMax=3 `
      -L "${PORTA}:${DESTINO}" $VPS

  # Codigo 0 so acontece quando alguem encerrou de proposito.
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Tunel encerrado."
    break
  }
  Write-Host "Tunel caiu (codigo $LASTEXITCODE). Reconectando em 3s..."
  Start-Sleep -Seconds 3
}
