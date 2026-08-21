#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/migrate-deploy.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/npx" <<'FAKE_NPX'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${FAKE_LOG:?}"

if [[ "$*" == *"migrate deploy"* ]]; then
  if [[ "${FAKE_FAIL_DEPLOY:-false}" == "true" ]]; then
    exit 17
  fi
  touch "${FAKE_DEPLOY_DONE:?}"
  exit 0
fi

if [[ "$*" == *"migrate status"* ]]; then
  # Antes do deploy, o Prisma pode retornar 1 por migrations pendentes.
  # O job corrigido nunca consulta status antes do deploy.
  if [[ ! -f "${FAKE_DEPLOY_DONE:?}" ]]; then
    exit 1
  fi
  exit 0
fi

exit 99
FAKE_NPX
chmod +x "$TMP_DIR/npx"

run_job() {
  local label="$1"
  export FAKE_LOG="$TMP_DIR/${label}.log"
  export FAKE_DEPLOY_DONE="$TMP_DIR/${label}.deploy.done"
  export PATH="$TMP_DIR:$PATH"
  export DATABASE_URL='postgresql://test.invalid/zelare'
  export NODE_ENV='development'
  rm -f "$FAKE_LOG" "$FAKE_DEPLOY_DONE"
  "$SCRIPT" >/dev/null
}

# Migration pendente: deploy deve ocorrer antes do status e o job deve concluir.
run_job pending
mapfile -t pending_calls < "$TMP_DIR/pending.log"
[[ "${pending_calls[0]}" == "prisma migrate deploy --schema=./prisma/schema.prisma" ]]
[[ "${pending_calls[1]}" == "prisma migrate status --schema=./prisma/schema.prisma" ]]

# Falha no deploy: o status final não pode ser executado.
export FAKE_LOG="$TMP_DIR/failure.log"
export FAKE_DEPLOY_DONE="$TMP_DIR/failure.deploy.done"
export FAKE_FAIL_DEPLOY=true
rm -f "$FAKE_LOG" "$FAKE_DEPLOY_DONE"
if "$SCRIPT" >/dev/null 2>&1; then
  echo 'esperava falha do deploy' >&2
  exit 1
fi
unset FAKE_FAIL_DEPLOY
mapfile -t failure_calls < "$TMP_DIR/failure.log"
[[ "${#failure_calls[@]}" -eq 1 ]]
[[ "${failure_calls[0]}" == "prisma migrate deploy --schema=./prisma/schema.prisma" ]]

echo 'migrate-deploy.sh: cenários de migration pendente e falha de deploy aprovados.'
