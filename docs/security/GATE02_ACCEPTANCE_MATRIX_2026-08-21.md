# Zelare — Matriz de aceite do Gate 0.2

**Data:** 21 de agosto de 2026. **Branch:** `fix/zelare-gate-0-2-20260821`. **SHA-base:** `08f335664ac5f714a787fd5f2038758b5b18efac`. **HEAD avaliado:** `45fd0f2`.

> Este documento não autoriza merge, deploy, execução de migration em produção ou remoção de dados. O Conexa/COCRIS não foi alterado.

## Resultado executivo

A fundação corretiva do Zelare está implementada em commits reversíveis e possui provas locais fortes para código, contratos, testes, builds, PWA desktop, privacidade de artifacts e budget. O Gate 0.2 ainda **não deve ser declarado aprovado para publicação**, pois a execução remota do workflow, o smoke de containers, o SBOM/licenças e a prova completa de PostgreSQL no runner ainda não foram observados neste ambiente. O histórico de migrations mantém a pré-condição documentada da migration `20260223000000_sala_virtual_recados_observacoes`, que não pode ser reescrita neste ciclo.

## Matriz de requisitos

| Requisito | Status | Arquivo/commit | Evidência | Observação |
|---|---|---|---|---|
| Branch corretiva a partir do SHA-base | IMPLEMENTADO E PROVADO | `git log`, branch atual | `GATE02_INSTALL_AFTER_PHASE8_COMMIT_2026-08-21.log` | Branch separada; sem merge. |
| PWA sem registro automático no desktop | IMPLEMENTADO E PROVADO | `apps/web/src/lib/pwaEligibility.ts`, `PwaRuntime.tsx`, `vite.config.ts` | `GATE02_E2E_PWA_DESKTOP_2026-08-21.log` | E2E Chromium desktop passou. |
| PWA mobile/iOS somente por ação do usuário | PARCIAL | `PwaInstallAction.tsx`, testes Vitest | `GATE02_FINAL_WEB_TESTS_2026-08-21.log` | Regras unitárias mobile/iOS passaram; Safari/Android reais ainda não foram executados. |
| Recuperação de cache/release e política no-cache | IMPLEMENTADO, NÃO PROVADO | `PwaRuntime.tsx`, `nginx.conf`, `vite.config.ts` | código revisado | Falta prova automatizada de SW antigo servindo bundle antigo. |
| Unidade explícita e RBAC | IMPLEMENTADO E PROVADO | commits `e7bba39`, `be47f16` | `GATE02_API_TESTS_AFTER_STORAGE_FIX_2026-08-21.log` | Testes RBAC e isolamento por unidade existentes e verdes. |
| Urgência operacional separada de acompanhamento | IMPLEMENTADO E PROVADO | commit `c3ecb2b` | logs de alertas do Gate | Canal/prioridade separados; não são inferência diagnóstica. |
| Migration SaaS aditiva | IMPLEMENTADO E PROVADO | commit `8f16742`, migration `20260821100000...` | `GATE02_ADDITIVE_MIGRATION_VERIFY_2026-08-21.log`, `GATE02_PRISMA_DRIFT_ZERO_2026-08-21.log` | Seis modelos, índices, uniques e FKs; sem DROP/RENAME. |
| Histórico de migration em banco vazio | PARCIAL | migration `20260223000000...` | relatório de fechamento da Fase 0 | Histórico assume tabelas legadas pré-existentes; não foi reescrito. |
| PII fora da imagem/contexto | IMPLEMENTADO E PROVADO | `apps/api/.dockerignore`, `check-sensitive-artifacts.mjs`, commit `17616d4` | `GATE02_ARTIFACTS_PHASE9_FINAL_2026-08-21.log` | 21 caminhos legados documentados; nenhum novo artifact permitido. |
| OpenAPI gerado no build | IMPLEMENTADO E PROVADO | `apps/api/src/scripts/generate-openapi.ts` | `GATE02_FINAL_OPENAPI_2026-08-21.log` | 254 rotas documentadas. |
| Chamadas HTTP do frontend contra OpenAPI | IMPLEMENTADO E PROVADO | `apps/web/scripts/validate-openapi.mjs` | `GATE02_FINAL_OPENAPI_2026-08-21.log` | 405 chamadas verificadas; nenhuma divergência reportada. |
| Vitest/Testing Library | IMPLEMENTADO E PROVADO | `apps/web/vitest.config.ts`, testes PWA | `GATE02_WEB_TESTS_PEDIDOS_ADMIN_FINAL_2026-08-21.log` | 2 arquivos, 7 testes aprovados. |
| E2E PWA desktop | IMPLEMENTADO E PROVADO | `apps/web/e2e/pwa.desktop.spec.ts` | `GATE02_E2E_PWA_DESKTOP_2026-08-21.log` | 1 cenário Chromium aprovado. |
| Workflow CI de 14 passos | IMPLEMENTADO, NÃO PROVADO | `.github/workflows/pr-gate.yml` | YAML lint e Prettier locais | Ainda depende de execução no GitHub Actions. |
| Bundle inicial e precache | IMPLEMENTADO E PROVADO | `apps/web/scripts/check-bundle-budget.mjs` | `GATE02_FINAL_WEB_BUDGET_2026-08-21.log` | 3.266.086 bytes bruto, 632.403 gzip, 4.334.580 precache; limites respeitados. |
| API, web e site compilam | IMPLEMENTADO E PROVADO | scripts dos três apps | logs `GATE02_FINAL_*_BUILD_2026-08-21.log` | Site corrigido para `2026-01-28.clover` do SDK instalado. |
| Pedidos Administrativos usa DTO real | IMPLEMENTADO E PROVADO | `PedidosAdministrativosPage.tsx`, commit `45fd0f2` | OpenAPI, typecheck e build | Criação usa `categoria`, `urgencia`, `justificativa`, `itens`; manutenção/OS removidas. |
| Acesso de criação de pedidos | IMPLEMENTADO E PROVADO | `material-request.controller.ts`, `PedidosAdministrativosPage.tsx` | contrato e typecheck | Criação visível somente para professor/professor auxiliar/developer; gestão revisa. |
| Upload RDX/documentos com storage real | IMPLEMENTADO, NÃO PROVADO | `rdx.controller.ts`, `children.service.ts` | typecheck/build | Rotas e persistência foram implementadas; falta smoke multipart autenticado. |
| Container smoke | BLOQUEADO | workflow CI | verificação local | Docker daemon não está disponível neste sandbox. |
| SBOM e licenças | IMPLEMENTADO, NÃO PROVADO | workflow CI | ação configurada | Deve ser confirmado no GitHub Actions. |
| Merge, deploy e migration de produção | IMPLEMENTADO E PROVADO | processo | ausência de operação | Nenhuma dessas operações foi executada. |

## Testes locais consolidados

A API concluiu **36 suítes e 271 testes** em modo serial. O frontend concluiu **2 arquivos e 7 testes Vitest**, além de **1 E2E desktop** aprovado. O OpenAPI documentou **254 operações** e o verificador encontrou correspondência para **405 chamadas HTTP** do frontend. Os três artefatos compiláveis — API, web e site — passaram após a correção do literal de versão do Stripe.

## Riscos residuais e decisão

O principal risco técnico residual é a reprodutibilidade do histórico de migrations: a migration `20260223000000` foi escrita contra um estado de banco de produção que já possuía tabelas legadas. A correção aditiva do Gate 0.2 não apaga esse fato e não usa `migrate resolve`, `db push` ou reescrita histórica. O segundo risco é operacional: sem Docker no sandbox e sem execução do GitHub Actions, os gates de imagem, smoke, SBOM/licenças e prova real de `migrate deploy` ainda não podem ser classificados como verdes.

A decisão correta neste ponto é **não publicar ainda**. O próximo passo seguro é enviar a branch para um PR separado, executar o workflow completo em runner com Docker/PostgreSQL, revisar cada gate e somente então pedir autorização humana explícita para qualquer migration/deploy.
