#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DATABASE_URL:?DATABASE_URL é obrigatória para executar migrations}"

if [[ "${ALLOW_PRODUCTION_MIGRATIONS:-false}" != "true" && "${NODE_ENV:-}" == "production" ]]; then
  echo "ERRO: migrations em produção exigem ALLOW_PRODUCTION_MIGRATIONS=true no job explícito."
  exit 1
fi

echo "Aplicando somente migrations versionadas e pendentes..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Verificando status final do schema Prisma canônico da API..."
npx prisma migrate status --schema=./prisma/schema.prisma

echo "Migrations concluídas sem resolução automática."
