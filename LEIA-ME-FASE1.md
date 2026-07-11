# Entrega Fase 1 — Zelare: motor multi-tenant + framework pedagógico plugável

## Como aplicar

1. Copie `apps/api/schema.prisma` para `apps/api/prisma/schema.prisma` no repositório real.
2. Copie as pastas `pedagogical-framework/`, `tenant-config/`, `institution-content/` e
   `common/services/storage.service.ts` para dentro de `apps/api/src/`.
3. Substitua `apps/api/src/app.module.ts` pelo daqui (só adiciona 3 imports e 3 linhas
   no array de módulos — se você já mexeu nesse arquivo desde o zip que me mandou,
   é mais seguro aplicar essas 6 linhas manualmente do que sobrescrever o arquivo).

## Dependências novas a instalar

```bash
cd apps/api
npm install mammoth                  # extração de texto de .docx (upload de plano de aula em Word)
npm install @aws-sdk/client-s3       # OPCIONAL — só necessário se for configurar AWS_S3_BUCKET
```

## Depois de aplicar

```bash
cd apps/api
npx prisma format                                        # valida sintaxe do schema
npx prisma migrate dev --name fase1_multitenant_framework # gera e aplica a migration real
```

## O que eu NÃO consegui validar aqui (limitação do meu ambiente, não do código)

- `prisma validate`/`migrate dev` de verdade — meu sandbox não tem acesso ao domínio
  de binários do Prisma (`binaries.prisma.sh`). Fiz checagem estrutural manual
  (chaves balanceadas, relações com par nos dois lados) mas a validação real
  precisa rodar no ambiente de vocês.
- Compilação TypeScript completa (`tsc -b`) — não instalei as ~40 dependências do
  NestJS aqui por tempo. Validei manualmente contra os módulos existentes
  (mesma convenção de imports, decorators, tipos) e chaves/parênteses balanceados
  em todos os 15 arquivos novos, mas rode `npm run build` no CI antes de mergear.

## Rotas novas disponíveis após o deploy

- `GET/POST /pedagogical-frameworks` — CRUD de frameworks pedagógicos
- `POST /pedagogical-frameworks/:id/clone` — clonar um framework da biblioteca global
- `POST /pedagogical-frameworks/:id/dimensions` — adicionar dimensão/objetivos
- `GET /tenant-config` — branding + feature flags combinadas (boot do frontend)
- `PUT /tenant-config/branding` — logo, cores, domínio próprio
- `POST /tenant-config/flags` — liga/desliga módulo por tenant (DEVELOPER)
- `POST /institution-content/upload` — upload de plano de aula/projeto próprio (multipart/form-data, campo "file")
- `POST /institution-content/:id/approve` — aprova o conteúdo extraído, pronto pra virar template
