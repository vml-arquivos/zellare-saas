# Onda 3 — Zelare Journey: evidências da fatia vertical

## Escopo e limites

Esta PR implementa somente **Zelare Journey — Captação, Visitas, Lista de Espera e Oferta de Vaga**. O fluxo reutiliza `Mantenedora`, `Unit`, `Classroom`, capacidade, matrículas ativas, usuários/roles, auditoria, outbox e manifesto existentes. O aceite de oferta cria apenas `JourneyEnrollmentDraft` incompleto; não cria `Child`, `Enrollment` ativo, `User` familiar, `ChildGuardian`, contrato, cobrança ou pagamento.

A flag persistida `journey_admissions_v1` permanece desligada por padrão. O bloqueio é aplicado no servidor e a navegação é condicionada à flag, capability, nível e tipo de papel. A PR não altera `vml-arquivos/conexa-v3.0`, não reabre a PR #20, não faz merge, deploy, migration ou ativação em produção.

## Baseline e rastreabilidade

| Item | Valor | Evidência |
|---|---|---|
| Branch | `feat/zelare-onda3-journey-20260822` | `git branch --show-current` |
| Base da PR #20 | `196e7f2deb37b030051b3088b0c4452fe7eec17f` | ancestral confirmado em `origin/main` |
| Pacote Onda 3 | `PACOTE_ZELARE_ONDA_3_JOURNEY_FAMILY_FINANCE_2026-08-21(1).zip` | revisão em `/home/ubuntu/research_zelare/onda3_journey_20260822/package-review.md` |
| SHA-256 do pacote | `7d31bc65e92c8583983172d55426ea9ab71f78776f6ce94a4624a7e925709c34` | checksum validado antes da implementação |
| Cluster Prisma | PostgreSQL 16 efêmero em `127.0.0.1:55432` | `/tmp/onda3-pgdata`, somente local/CI |

## Contratos REST Journey

| Método | Rota | Finalidade | Mutável | Proteções principais |
|---|---|---|---:|---|
| `GET` | `/journey/units` | unidades autorizadas | não | flag, tenant, escopo |
| `GET` | `/journey/dashboard` | indicadores e capacidade real | não | tenant/unidade |
| `GET/POST` | `/journey/prospects` | listar/captar interessado | POST | allowlist, consentimento, hashes privados, idempotência |
| `GET` | `/journey/prospects/:id` | detalhe administrativo | não | tenant/unidade |
| `PATCH` | `/journey/prospects/:id/stage` | alterar estágio | sim | capability, escopo, auditoria, idempotência |
| `POST` | `/journey/prospects/:id/activities` | registrar interação/nota/follow-up | sim | allowlist, escopo, idempotência |
| `POST` | `/journey/prospects/:id/tasks` | criar tarefa | sim | escopo, idempotência |
| `PATCH` | `/journey/tasks/:id/complete` | concluir tarefa | sim | escopo, auditoria |
| `GET/POST` | `/journey/visits` | listar/agendar visita | POST | conflito temporal por interessado, usuário ativo, escopo |
| `PATCH` | `/journey/visits/:id/reschedule` | reagendar | sim | intervalo, conflito, evento append-only |
| `PATCH` | `/journey/visits/:id/cancel` | cancelar | sim | evento, idempotência |
| `PATCH` | `/journey/visits/:id/confirm` | confirmar presença | sim | evento, estágio, idempotência |
| `PATCH` | `/journey/visits/:id/absence` | registrar ausência | sim | evento, idempotência |
| `PATCH` | `/journey/visits/:id/follow-up` | follow-up humano | sim | evento, idempotência |
| `GET/POST` | `/journey/waitlist/policies` | listar/criar versão | POST | vigência, governança, idempotência |
| `PATCH` | `/journey/waitlist/policies/:id/review` | revisão humana | sim | revisor diferente do criador, `reviewedAt` |
| `PATCH` | `/journey/waitlist/policies/:id/publish` | publicação | sim | criador/revisor/publicador distintos, vigência |
| `GET/POST` | `/journey/waitlist` | listar/entrar na espera | POST | política publicada/vigente, explicação, escopo |
| `GET/POST` | `/journey/offers` | listar/criar oferta | POST | lock de turma, capacidade real, idempotência, override justificado |
| `PATCH` | `/journey/offers/:id/decision` | aceitar/recusar | sim | expiração, lock, rechecagem, draft incompleto |
| `GET` | `/journey/duplicates` | fila de revisão | não | hashes não expostos, tenant/unidade |
| `PATCH` | `/journey/duplicates/:id/review` | confirmar/rejeitar duplicidade | sim | revisão humana e auditoria |
| `POST` | `/journey/duplicates/:id/undo` | desfazer merge | sim | estado, auditoria, outbox |

O contrato OpenAPI local foi gerado no build da API e contém 24 paths Journey.

## Matriz de autorização

| Perfil/tipo | Flag desligada | Flag ligada | Escopo de leitura | Escrita de Journey | Override de capacidade |
|---|---:|---:|---|---|---:|
| `UNIDADE_ADMINISTRATIVO` | negado | permitido | unidade autorizada | ações Journey autorizadas pelo serviço | negado |
| `UNIDADE_DIRETOR` | negado | permitido | unidade autorizada | ações Journey autorizadas pelo serviço | negado |
| `UNIDADE_COORDENADOR_PEDAGOGICO` | negado | permitido | unidade autorizada | ações Journey autorizadas pelo serviço | negado |
| `STAFF_CENTRAL_PEDAGOGICO` | negado | permitido | rede/unidades autorizadas | ações Journey autorizadas pelo serviço | permitido |
| `MANTENEDORA_ADMIN` | negado | permitido | rede/unidades autorizadas | ações Journey autorizadas pelo serviço | permitido |
| `DEVELOPER` | negado | permitido | rede autorizada | ações Journey autorizadas pelo serviço | permitido |
| Psicologia/Nutrição/Professor/Família | negado | negado | sem manifesto e sem capability | negado | negado |

Toda consulta filtra `mantenedoraId` e valida unidade/turma no backend; o filtro da UI não é a fronteira de segurança.

## Evidências de teste e gate

Todos os comandos de código abaixo foram executados novamente no commit verificável `b2f747613fdac63f5fcacb8e57786ef8aab8a1c7`, após o corretivo de privacidade. O commit de entrega posterior contém somente esta atualização documental; o log integral está em `/home/ubuntu/terminal_full_output/2026-08-22_08-31-00_969172_10669.txt`.

| Gate | Comando | Resultado final | Log/evidência |
|---|---|---|---|
| Instalação reprodutível | `pnpm install --frozen-lockfile` | passou; lockfile atualizado e instalação concluída | terminal final, linhas iniciais |
| Lint API Journey | `pnpm --filter @zelare/api exec eslint src/journey src/journey/dto/journey.dto.ts` | passou no HEAD final | terminal final |
| Lint web Journey | `pnpm --filter @zelare/web exec eslint src/pages/JourneyPage.tsx src/pages/JourneyActionPanels.tsx src/pages/JourneyActionPanels.test.tsx src/api/journey.ts` | passou no HEAD final | terminal final |
| Typecheck API | `pnpm --filter @zelare/api typecheck` | passou no HEAD final | terminal final |
| Typecheck web | `pnpm --filter @zelare/web exec tsc --noEmit` | passou no HEAD final | terminal final |
| Unit API | `pnpm --filter @zelare/api test -- --runInBand` | 47 suítes / 347 testes passaram | log final, resumo Jest |
| Unit Journey | incluído em `pnpm --filter @zelare/api test -- --runInBand` | specs Journey passaram dentro das 47 suítes / 347 testes | log final, `src/journey/*spec.ts` |
| Unit web | `pnpm --filter @zelare/web test` | 5 arquivos / 18 testes passaram | log final, resumo Vitest |
| API E2E | `DATABASE_URL=... JWT_SECRET=... JWT_REFRESH_SECRET=... pnpm exec jest --config test/jest-e2e.json --runInBand` | 2 testes passaram com banco local descartável | log final, resumo Jest E2E |
| API build/OpenAPI | `pnpm --filter @zelare/api build` | passou; 329 rotas totais / 24 Journey | `apps/api/dist/openapi.json` gerado localmente |
| Web build/budget | `NODE_ENV=production VITE_API_URL=... pnpm --filter @zelare/web build && ... budget:check` | passou; JS inicial 77.750 bytes, gzip 20.611 bytes, precache 4.474.774 bytes | log final, budget |
| Site build | build com canais `.test` | passou; canais públicos sintéticos validados | log final |
| Privacidade | `pnpm --filter @zelare/api security:artifacts` | passou; 1.061 arquivos versionados verificados e 0 conteúdo sensível | log final |
| Prisma clean cluster | `prisma-clean-cluster-gate.sh` | `CLEAN_CLUSTER_PRISMA_DRIFT=0`; 48 migrations aplicadas e schema atualizado | log final e script em `evidence/` |
| Concorrência | `node apps/api/scripts/verification/journey-concurrency.mjs` | 1 sucesso / 1 `ConflictException`; 1 oferta; 0 Child/Enrollment/Draft; replay igual | terminal do gate |
| E2E autenticado | `JOURNEY_E2E_PASSWORD=... node evidence/capture-journey-e2e.cjs` | passou; 4 screenshots, desktop/mobile, confirmação real de visita e releitura | `evidence/screenshots/` e log final |

## Rollback e canário

A migration `20260822200000_onda3_journey_foundation` é forward-only e aditiva; a coluna `overrideReason` é nullable. Não há `DROP`, `DELETE` ou alteração de tabelas canônicas no SQL Journey. O rollback de aplicação é feito por desativação server-side da flag `journey_admissions_v1`, sem apagar dados. O canário recomendado é um tenant descartável/piloto com a flag ligada, monitorando erros 4xx/5xx, conflitos de capacidade, duplicidades, latência e outbox antes de qualquer expansão. Produção não foi migrada ou ativada nesta tarefa.

## Evidência visual

As imagens em `/home/ubuntu/research_zelare/onda3_journey_20260822/evidence/screenshots/` são capturas reais do navegador autenticado com fixture sintético. A visão desktop mostra indicadores, funil, menu e abas Journey. A visão mobile mostra cabeçalho compacto, seletor, abas com rolagem horizontal e cards responsivos. O capturador executa confirmação de presença e espera o estado `REALIZADA` após a releitura.
