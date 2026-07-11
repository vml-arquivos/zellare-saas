# Completar banco do Zelare — maio até hoje

Este pacote adiciona um script seguro para completar dados estruturais do banco antes do deploy/redeploy.

## O que o script faz

1. Confere se as unidades de referência estão cadastradas.
2. Cria ou atualiza as unidades faltantes com base em `apps/api/prisma/units.json`.
3. Confere se existem matrizes curriculares 2026 para `EI01`, `EI02` e `EI03`.
4. Completa as entradas da matriz curricular do período de maio até a data atual.
5. Não apaga dados existentes.
6. Não cria migration.
7. Não altera `schema.prisma`.
8. Pode rodar mais de uma vez sem duplicar dados.

## Arquivo adicionado

```text
apps/api/scripts/seed-completar-maio-hoje-unidades.js
```

## Script adicionado ao package.json da API

```bash
npm run seed:completar-maio-hoje
```

## Como rodar com segurança

Entre no container/API ou no terminal do ambiente onde a API tem acesso ao banco e rode:

```bash
cd /app
npm run seed:completar-maio-hoje
```

Se estiver rodando pelo código-fonte, entre na pasta da API:

```bash
cd apps/api
npm run seed:completar-maio-hoje
```

## Rodar somente como teste, sem gravar no banco

```bash
cd apps/api
DRY_RUN=true npm run seed:completar-maio-hoje
```

## Definir período manualmente

Por padrão, o script começa em `2026-05-01` e termina na data do dia em que for executado.

Para forçar até uma data específica:

```bash
cd apps/api
START_DATE=2026-05-01 END_DATE=2026-06-12 npm run seed:completar-maio-hoje
```

## Usar uma mantenedora específica

Se houver mais de uma mantenedora no banco, informe o ID:

```bash
cd apps/api
MANTENEDORA_ID="ID_DA_MANTENEDORA" npm run seed:completar-maio-hoje
```

## Atualizar entradas já existentes

Por padrão, entradas já existentes são preservadas. Para atualizar também as existentes:

```bash
cd apps/api
FORCE_UPDATE=true npm run seed:completar-maio-hoje
```

Use `FORCE_UPDATE=true` somente quando tiver certeza de que deseja substituir o conteúdo existente das entradas de maio até hoje.

## Ordem correta antes do redeploy

1. Fazer backup do banco.
2. Aplicar migrations pendentes, se existirem:

```bash
cd apps/api
npm run db:status
npm run db:migrate:deploy
```

3. Rodar o script de complemento:

```bash
npm run seed:completar-maio-hoje
```

4. Fazer redeploy da API.
5. Fazer redeploy do frontend.
6. Testar login, unidades, turmas, matriz curricular e telas pedagógicas.

## Importante

Este script não substitui documentos pedagógicos oficiais. Ele completa a estrutura operacional do banco para que o sistema consiga trabalhar com as datas de maio até hoje. Conteúdos pedagógicos oficiais podem ser refinados depois, sem quebrar a estrutura.
