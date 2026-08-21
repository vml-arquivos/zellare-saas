# syntax=docker/dockerfile:1
# =========================
# Builder (devDeps + Prisma Client + build + prune)
# =========================
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV CI=true
# Prisma em Debian slim precisa do openssl para geração do client
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Copiar o schema.prisma antes do npm ci para invalidar o cache quando o contrato
# de dados mudar e gerar o Prisma Client no mesmo build imutável.
COPY prisma ./prisma
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund
COPY . .
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build
# Remove devDependencies, mas mantém o Prisma Client gerado dentro do node_modules
RUN npm prune --omit=dev
# =========================
# Runner (prod runtime + healthcheck tools + node_modules vindo do builder)
# =========================
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# wget: usado pelo Coolify healthcheck
# curl: usado pela aplicação
# openssl + ca-certificates: necessários para Prisma e HTTPS
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
    wget \
    curl \
    openssl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Copia o node_modules já "podado" do builder (contém Prisma Client gerado)
COPY --from=builder /app/node_modules ./node_modules
# Copia artefatos e metadados do app; migrations ficam disponíveis para o job
# explícito de deploy, nunca para execução automática no startup.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/datasets ./datasets
# Arquivos CSV usados pelo seed de catálogo (catalogo_pedagogico.csv, catalogo_higiene_pessoal.csv)
COPY --from=builder /app/data ./data
COPY package.json package-lock.json ./
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 3000
CMD ["./entrypoint.sh"]
