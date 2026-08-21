#!/usr/bin/env bash
set -eu

echo "=== Zelare API Entrypoint ==="

echo "Validando variáveis de ambiente obrigatórias..."
for VAR in DATABASE_URL JWT_SECRET; do
  if [ -z "${!VAR:-}" ]; then
    echo "ERRO: variável obrigatória '$VAR' não definida."
    exit 1
  fi
done
echo "Configuração obrigatória validada."

# O startup da aplicação é deliberadamente somente leitura.
# Migrations, reparos, seeds, backfills, imports e geração do Prisma Client
# pertencem a jobs/comandos explícitos e auditáveis, executados antes do deploy.
# Não resolver migrations automaticamente: em caso de falha, o deploy deve falhar
# e a equipe responsável deve investigar e executar `prisma migrate resolve` de
# forma humana, documentada e específica para a migration afetada.
for VAR in RUN_DB_MIGRATIONS_ON_STARTUP RUN_ACCESS_FIX_ON_DEPLOY RUN_ALIMENTOS_SEED_ON_DEPLOY RUN_IMPORT_RESPONSAVEIS_ON_DEPLOY RUN_PRISMA_GENERATE_ON_STARTUP; do
  if [ "${!VAR:-false}" = "true" ]; then
    echo "ERRO: $VAR=true é incompatível com o startup seguro do Zelare. Execute a operação em job/comando separado."
    exit 1
  fi
done

echo "Startup seguro: nenhuma migration, correção, seed, import ou backfill será executado automaticamente."

echo "Iniciando aplicação NestJS..."
if [ -f /app/dist/src/main.js ]; then
  exec node /app/dist/src/main.js
elif [ -f /app/dist/main.js ]; then
  exec node /app/dist/main.js
else
  echo "ERRO: entrypoint compilado não encontrado em /app/dist."
  ls -la /app/dist/ 2>/dev/null || true
  exit 1
fi
