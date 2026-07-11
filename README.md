# Zelare SaaS

**Zelare — cuidado, pedagogia e gestão inteligente.**

Este repositório contém a base inicial do novo sistema Zelare, preparado para evoluir como uma plataforma SaaS multi-entidade para instituições públicas e privadas.

## Objetivo do projeto

O Zelare nasce a partir de uma base já funcional de gestão pedagógica, mas passa a ter identidade própria e será preparado para atender várias entidades, cada uma com seus próprios usuários, dados, configurações e permissões.

## Estrutura principal

- `apps/api`: API em NestJS com Prisma.
- `apps/web`: painel web em React/Vite.
- `apps/site`: aplicação/site auxiliar.
- `packages`: pacotes compartilhados.
- `docker-compose.yml`: base de orquestração local.

## Identidade visual

Os arquivos de marca ficam em:

```text
apps/web/public/brand/
apps/web/public/branding/zelare/
```

Arquivos principais:

- `zelare-logo-square.png`
- `zelare-logo-horizontal.png`
- `zelare-logo-dark-horizontal.png`
- `zelare-icon-card.png`
- `favicon.png`

## Deploy seguro

Antes de redeploy em produção ou homologação:

1. Conferir variáveis de ambiente no Coolify.
2. Conferir se o banco correto está configurado.
3. Se houver alterações em `prisma/schema.prisma` ou novas migrations, rodar migrations antes do redeploy.
4. Só depois fazer redeploy da API e do frontend.

Para produção, use migration deploy, nunca migration dev.

```bash
cd apps/api
npm run db:status
npm run db:migrate:deploy
```

## Observação importante

Nesta primeira etapa foram aplicadas personalizações de identidade visual, nome, favicon e textos institucionais. A estrutura multi-entidade será feita em etapa posterior, com migrations planejadas e controladas.
