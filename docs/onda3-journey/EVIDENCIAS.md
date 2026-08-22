# Onda 3 — Zelare Journey: matriz final de requisitos e evidências

## Escopo, autorização e limites

Esta PR permanece limitada à fatia **Zelare Journey — Captação, Visitas, Lista de Espera e Oferta de Vaga**, com as pendências Family/LGPD necessárias ao Gate UX 0.4.1. A implementação reutiliza `Mantenedora`, `Unit`, `Classroom`, capacidade, matrículas ativas, usuários/roles, auditoria, outbox e manifesto existentes. A aceitação de oferta cria somente um `JourneyEnrollmentDraft` incompleto; não cria `Child`, `Enrollment` ativo, usuário familiar, contrato, cobrança, pagamento ou qualquer domínio Family Finance.

A flag persistida `journey_admissions_v1` permanece desligada por padrão e foi exercitada desligada/ligada somente em bancos sintéticos descartáveis. Nenhum dado real foi acessado ou alterado. Nenhum arquivo do Conexa/COCRIS foi alterado, e a PR #20 não foi reaberta. A autorização posterior para merge e redeploy será tratada somente depois de os gates do novo SHA estarem verdes; a flag Journey continuará sem ativação explícita em produção.

## Rastreabilidade do estado validado

| Item           | Valor                                                                       | Evidência                                                                                    |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Branch         | `feat/zelare-onda3-journey-20260822`                                        | `git branch --show-current`                                                                  |
| PR             | `#21` aberta, base `main`                                                   | `gh pr view 21`                                                                              |
| Base conhecida | `196e7f2deb37b030051b3088b0c4452fe7eec17f0`                                 | `origin/main` é ancestral do branch                                                          |
| Feature flag   | `journey_admissions_v1`, default desligado                                  | `journey-access.service.ts`, E2E de flag                                                     |
| Banco E2E      | PostgreSQL 16 descartável em `127.0.0.1:55432`                              | `zellare_e2e`, somente fixture sintética                                                     |
| Fixture        | organizações, unidades, turmas, usuários e prospectos `example.invalid`     | `apps/api/scripts/verification/journey-e2e-fixture.mjs`                                      |
| Migrations     | `20260822200000_onda3_journey_foundation`, aditiva/forward-only             | migration SQL e replay oficial PG16 anterior                                                 |
| Pacote Onda 3  | checksum `7d31bc65e92c8583983172d55426ea9ab71f78776f6ce94a4624a7e925709c34` | revisão do pacote em `/home/ubuntu/research_zelare/onda3_journey_20260822/package-review.md` |

## Implementação e contratos

| Requisito                                | Implementação                                                                                                                                                                                                                               | Cobertura/evidência                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RBAC organizacional por capability       | `JourneyAccessService`, `JourneyCapabilityGuard` e `RequireJourneyCapability`; `STAFF_CENTRAL_ADMISSOES` recebeu capacidades operacionais de admissões; gestão pedagógica, psicologia, nutrição, professor, família e financeiro ficam fora | `journey-access.service.spec.ts`, `journey-capability.guard.spec.ts`, E2E RBAC por endpoint                                                               |
| Separação Journey na navegação           | rotas e manifesto limitados a administrativo de unidade, direção, admissões central, mantenedora admin e developer                                                                                                                          | `navigationManifest.test.ts`, `journeyNavigation.test.ts`, browser E2E autenticado como admissions                                                        |
| Isolamento por organização/unidade/turma | toda consulta aplica `mantenedoraId`; unidades e turmas são validadas no backend; respostas fora do escopo são 404                                                                                                                          | E2E com prospecto de tenant estrangeiro, prospecto de unidade isolada, turma incompatível e turma estrangeira; testes unitários de `JourneyAccessService` |
| LGPD server-side                         | consentimentos, bases legais, versão de política e retenção são validados no serviço; payload adulterado não contorna a validação                                                                                                           | E2E de consentimento adulterado, persistência de privacidade e testes de `FamilyService`                                                                  |
| HMAC versionado                          | contatos usam `hmac-sha256-v1` com segredo dedicado; SHA-256 simples não é usado como fronteira de identificação                                                                                                                            | fixture sintética cifrada, assertions de versão, scanner de artefatos                                                                                     |
| Criptografia e mascaramento              | contatos persistidos novos ficam sem plaintext, com AES-256-GCM versionado; respostas administrativas mascaram e não devolvem hash/ciphertext                                                                                               | E2E verifica `a***@example.invalid`, `***01` e ausência de campos privados                                                                                |
| Retenção, revogação e eliminação         | retenção limitada a dois anos; revogação idempotente; eliminação lógica anonimiza contatos e preserva ledger/auditoria                                                                                                                      | E2E após reload, contagem de `JourneyProspectPrivacyEvent`, unitários de Journey/Family                                                                   |
| Retenção e expiração em consultas        | listagens, dashboard, visitas, ofertas e duplicidades excluem eliminados e expirados                                                                                                                                                        | specs de serviço e E2E de privacidade                                                                                                                     |
| Máquina de estados explícita             | `JOURNEY_ALLOWED_STAGE_TRANSITIONS` e `transitionIfNeeded`; update otimista por `id + stage + version`                                                                                                                                      | `journey.constants.ts`, `journey.service.spec.ts`, E2E de fluxo, harness de concorrência                                                                  |
| Concorrência e idempotência              | locks de turma, chaves idempotentes, replay determinístico, draft sem matrícula definitiva                                                                                                                                                  | `journey-concurrency.mjs`, E2E activity/offer/replay, teste de concorrência                                                                               |
| Governança de política                   | criação, revisão e publicação exigem atores distintos; vigência e intervalos são validados                                                                                                                                                  | E2E `exige revisão e publicação por atores diferentes` e specs de política                                                                                |
| Family/LGPD Gate UX 0.4.1                | policy compartilhada e `FamilyPrivacyGuard`; vínculo exige CONSENT/policy/retention; revogação exige motivo, remove permissões e registra `ConsentGrant REVOGADO`                                                                           | `family.service.spec.ts`, controller/policy/guard, Vitest web e lint focado                                                                               |

## Rotas REST Journey principais

| Método           | Rota                                                                              | Proteções principais                                              |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET`            | `/journey/units`, `/journey/dashboard`                                            | flag, tenant, capability e escopo de unidade                      |
| `GET/POST`       | `/journey/prospects`                                                              | capability, consentimento, base legal, HMAC/cifra, idempotência   |
| `GET/PATCH`      | `/journey/prospects/:id` e `/stage`                                               | tenant/unidade, estado permitido, versão e auditoria              |
| `POST`           | `/journey/prospects/:id/activities` e `/tasks`                                    | allowlist, escopo e idempotência                                  |
| `PATCH`          | `/journey/tasks/:id/complete`                                                     | escopo e auditoria                                                |
| `GET/POST`       | `/journey/visits`                                                                 | unidade/prospect alinhados, intervalo, conflito e usuário ativo   |
| `PATCH`          | `/journey/visits/:id/reschedule`, `/confirm`, `/cancel`, `/absence`, `/follow-up` | evento append-only, escopo e idempotência                         |
| `GET/POST`       | `/journey/waitlist/policies`, `/journey/waitlist`                                 | intervalo, vigência, governança, política publicada e escopo      |
| `PATCH`          | `/journey/waitlist/policies/:id/review`, `/publish`                               | revisão/publicação por atores distintos                           |
| `GET/POST`       | `/journey/offers`                                                                 | turma real, capacidade, lock, override justificado e idempotência |
| `PATCH`          | `/journey/offers/:id/decision`                                                    | expiração, lock, rechecagem e draft incompleto                    |
| `GET/PATCH/POST` | duplicidades, revisão e undo                                                      | escopo, revisão humana, estado `ARQUIVADO`, auditoria e outbox    |
| `PATCH`          | `/journey/prospects/:id/privacy/retention`, `/contact/revoke`, `/erase`           | capability de privacidade, motivo, idempotência e ledger          |

O contrato OpenAPI local foi gerado durante o build da API e permanece compatível com os contratos consumidos pela web. A checagem frontend percorreu 228 arquivos-fonte e 412 chamadas HTTP.

## Matriz requisito → teste → evidência

| Requisito de aceite                                               | Teste executado                                 | Resultado/evidência                                                                                            |
| ----------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Administrativo/admissões operam; coordenação pedagógica não opera | API E2E `aplica RBAC granular por endpoint...`  | passou; 403 para coordenação pedagógica e acesso permitido para administrativo/admissões                       |
| Tenant, unidade e turma sem IDOR                                  | API E2E `mantém escopo tenant/unidade/turma...` | passou; 404 para tenant estrangeiro, unidade isolada, turma incompatível e turma estrangeira                   |
| Payload adulterado não cria contato sem consentimento             | API E2E `rejeita payload adulterado...`         | passou; 400 server-side                                                                                        |
| Flag desligada bloqueia e religação sintética retorna             | API E2E `respeita flag desligada...`            | passou; 403 desligada, 200 após reativação no tenant sintético                                                 |
| Revisão/publicação com SoD                                        | API E2E `exige revisão e publicação...`         | passou; `createdBy`, `reviewedBy` e `publishedBy` distintos conforme assertions                                |
| Atividade com replay                                              | API E2E de mutações                             | passou; mesma atividade no replay idempotente                                                                  |
| Tarefa e conclusão                                                | API E2E de mutações                             | passou; criação 201 e conclusão 200                                                                            |
| Visita, reagendamento, confirmação e follow-up                    | API E2E de mutações                             | passou; fluxo completo com eventos                                                                             |
| Lista de espera por política vigente                              | API E2E de mutações                             | passou; entrada `AGUARDANDO` usando política publicada/compatível                                              |
| Oferta e aceitação sem matrícula definitiva                       | API E2E de mutações                             | passou; oferta aceita e draft, sem `Child`/`Enrollment` ativo                                                  |
| Duplicidade, revisão e undo                                       | API E2E de mutações                             | passou; undo 201 e prospecto retorna à etapa esperada                                                          |
| Retenção, revogação e eliminação após reload                      | API E2E `persiste retenção...`                  | passou; contato removido, status `ERASED`, ledger preservado e GET 410                                         |
| Capacidade e concorrência                                         | `journey-concurrency.mjs`                       | passou anteriormente; 1 sucesso/1 `ConflictException`, uma oferta, zero matrícula/draft indevido, replay igual |
| Responsividade em 320/360/390/412/768                             | Playwright browser E2E                          | passou 1/1; 7 abas, cadastro, reload, overflow horizontal ausente                                              |
| Console sem erros e HAR redigido                                  | Playwright + scanner local                      | `journey-console.log` contém `CLEAN`; HAR final sanitizado, 238 entradas, sem valores de token/cookie/contato  |

## Gates locais executados no estado atual

Os logs abaixo são integrais e ficam fora do repositório em `/home/ubuntu/research_zelare/onda3_journey_20260822/evidence/gates/`. O lint global da web mantém baseline legado de 797 erros/35 avisos dentro do limite CI de 800/35; não é declarado como zero. O lint global da API possui baseline legado elevado e também não é declarado como verde; o lint focado dos arquivos alterados passou.

| Gate                           | Comando/escopo                                                        | Resultado atual                                                              | Evidência                                       |
| ------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| API typecheck                  | `pnpm --filter @zelare/api typecheck`                                 | passou                                                                       | `api-typecheck-final.log`                       |
| API unitários                  | `pnpm --filter @zelare/api test -- --runInBand`                       | 48 suítes / 358 testes passaram                                              | `api-units-final.log`                           |
| API E2E autenticado            | fixture sintética + Jest `test/journey.e2e-spec.ts`                   | 7 testes passaram                                                            | `api-authenticated-e2e-all-mutations-final.log` |
| Web contracts/typecheck/Vitest | `contracts:check`, `tsc -b`, `test -- --run`                          | 228 arquivos; typecheck passou; 5 arquivos / 19 testes passaram              | `web-contracts-typecheck-vitest-final.log`      |
| Lint focado                    | API `src` e web `src` alterados                                       | passou com `--max-warnings=0`                                                | `focused-lint-final.log`                        |
| Privacidade/artefatos          | `pnpm --filter @zelare/api security:artifacts`                        | 1.061 arquivos, 0 conteúdo sensível                                          | `privacy-artifacts-final.log`                   |
| Build/OpenAPI/budget           | build API, build web e `budget:check`                                 | passou; JS inicial 78.336 bytes, gzip 20.688 bytes, precache 4.483.803 bytes | `build-openapi-budget-final.log`                |
| Diff/migration/secret          | `git diff --check`, scanner destrutivo e scanner de conteúdo alterado | passou; migration sem `DROP/DELETE/TRUNCATE`; scan de segredos passou        | `diff-migration-secret-final.log`               |
| PostgreSQL 16 zero-to-drift    | replay oficial histórico em banco descartável                         | anteriormente passou: 48 migrations, status atualizado, drift zero           | `prisma-postgresql-official-pg16-rerun.log`     |
| Browser autenticado            | admissions sintético, abas e viewports                                | passou 1/1; console `CLEAN`                                                  | `browser-final/playwright.log`                  |
| CI do novo SHA                 | ainda não executado neste novo commit                                 | pendente até push/CI                                                         | atualizar somente após `gh pr checks 21`        |

## Evidências browser

As capturas finais estão em `/home/ubuntu/research_zelare/onda3_journey_20260822/evidence/`: `journey-overview-320.png`, `journey-overview-360.png`, `journey-overview-390.png`, `journey-overview-412.png`, `journey-overview-768.png`, `journey-reports-768.png`, `journey-responsive.webm`, `journey-responsive.har` e `journey-console.log`. O vídeo foi copiado da última execução aprovada; o HAR bruto foi removido após redação determinística dos valores sensíveis. O diretório `browser-final/results/` preserva o resultado bruto Playwright necessário para auditoria local, fora do Git.

## Migrations, rollback e operação

A migration `20260822200000_onda3_journey_foundation` é aditiva e forward-only. A preparação de pré-requisitos históricos usada para reproduzir o CI só foi executada no banco PostgreSQL 16 descartável; nunca deve ser executada contra produção. Não há rollback destrutivo: o rollback funcional é a desativação server-side da flag `journey_admissions_v1`, sem apagar dados. Merge, redeploy, migration de produção e ativação da flag são operações separadas; a flag não será ativada automaticamente por esta PR.

## Estado de entrega

Antes do push, a PR permanece aberta e sem merge; a validação local acima está verde nos escopos declarados. O SHA final, o resultado do CI do novo SHA, o merge e o redeploy só podem ser registrados depois que forem realmente executados e verificados. Nenhum status remoto anterior será reutilizado como evidência do commit corretivo.

## Referências internas

| Referência            | Local                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Implementação Journey | `apps/api/src/journey/journey.service.ts` e `journey-access.service.ts`                        |
| Guard de capability   | `apps/api/src/journey/journey-capability.guard.ts`                                             |
| Privacy Family        | `apps/api/src/family/family-privacy-access.ts`, `family-privacy.guard.ts`, `family.service.ts` |
| Migration             | `apps/api/prisma/migrations/20260822200000_onda3_journey_foundation/migration.sql`             |
| E2E API               | `apps/api/test/journey.e2e-spec.ts`                                                            |
| Fixture sintética     | `apps/api/scripts/verification/journey-e2e-fixture.mjs`                                        |
| E2E browser           | `apps/web/e2e/journey-responsive.spec.ts`                                                      |
| Workflow              | `.github/workflows/pr-gate.yml`                                                                |
