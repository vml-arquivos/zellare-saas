# Zelare — Matriz final de aceite do Gate 0.2

**Data:** 21 de agosto de 2026. **Branch:** `fix/zelare-gate-0-2-20260821`. **Base:** `08f335664ac5f714a787fd5f2038758b5b18efac` (`08f3356`). **HEAD avaliado:** `ca8bfbe3560c683c2849a5c6545092f76f1b4149` (`ca8bfbe`). **PR:** [#12 — Gate 0.2: contratos reais, OpenAPI, PWA e privacidade](https://github.com/vml-arquivos/zellare-saas/pull/12).

> Esta matriz registra a aprovação técnica do Gate 0.2 no CI, mas **não autoriza merge, migration de produção, deploy, redeploy ou remoção de dados**. O PR permanece aberto para revisão e decisão humana. O repositório Conexa/COCRIS não foi alterado.

## Resultado executivo

O Gate 0.2 está **verde no GitHub Actions**. A execução final [32453168092](https://github.com/vml-arquivos/zellare-saas/actions/runs/32453168092), run #16, no HEAD `ca8bfbe`, terminou com conclusão `success`. A execução técnica anterior [32452784952](https://github.com/vml-arquivos/zellare-saas/actions/runs/32452784952), no commit `58cbe02`, também terminou com os 14 jobs verdes. O PR #12 está aberto, não é draft e aparece com estado de merge `CLEAN`; nenhuma operação de merge ou produção foi executada por esta tarefa.

O bloqueador histórico de PostgreSQL foi resolvido sem `migrate resolve`, `db push`, reescrita de histórico ou alteração do Conexa. A prova remota aplicou as migrations em PostgreSQL 17 efêmero, executou o cleanup da fixture e confirmou drift nulo. A reprodução local equivalente também terminou com status de migrations atualizado e saída de drift vazia; o único texto adicional local foi o warning conhecido do pnpm, que passou a ser filtrado exclusivamente na captura do artefato de drift do workflow.

## Matriz de requisitos e evidências

| Requisito | Status final | Evidência principal | Observação de aceite |
|---|---|---|---|
| Branch corretiva a partir do SHA-base | **IMPLEMENTADO E PROVADO** | Branch `fix/zelare-gate-0-2-20260821`; PR #12 | Branch separada; sem merge. |
| PWA sem registro automático no desktop | **IMPLEMENTADO E PROVADO** | `pwaEligibility.ts`, `PwaRuntime.tsx`, `vite.config.ts`; job `e2e` verde | E2E Chromium desktop aprovado. |
| PWA mobile/iOS somente por ação do usuário | **IMPLEMENTADO E PROVADO NO CI** | Testes Vitest e E2E do workflow | Validação em Safari/Android físicos continua recomendável antes da comunicação comercial. |
| Recuperação de cache/release e política no-cache | **IMPLEMENTADO E PROVADO** | `PwaRuntime.tsx`, `nginx.conf`, `vite.config.ts`; jobs `builds` e `bundle-pwa-budget` verdes | Política de HTML, manifest, service worker e assets hashados validada no pipeline. |
| Unidade explícita, RBAC e isolamento por unidade | **IMPLEMENTADO E PROVADO** | Commits `e7bba39` e `be47f16`; `api-tests` e `typecheck` verdes | Sem fallback de unidade ou permissões administrativas fantasmas. |
| Urgência operacional separada de acompanhamento | **IMPLEMENTADO E PROVADO** | Commit `c3ecb2b`; testes API verdes | Urgência operacional não é inferência diagnóstica. `diagnosticInference: false` e `humanReviewRequired: true` permanecem preservados. |
| Fixture histórica do PostgreSQL | **IMPLEMENTADO E PROVADO** | `ci-prepare-historical-prerequisites.sql`; job `prisma-postgresql` verde | Stubs lowercase para `child`, `classroom`, `unit` e `mantenedora`; cleanup após a faixa histórica. |
| Comparações de faixa de migrations no workflow | **IMPLEMENTADO E PROVADO** | Commit `ecf1909` | Comparações Bash inclusivas corrigidas sem alterar a seleção lógica das migrations. |
| Sintaxe idempotente de constraints históricas | **IMPLEMENTADO E PROVADO** | Commit `a57b1f3`; migration `20260420010000_microgesto_registro_child_stats_alertas` | `ADD CONSTRAINT IF NOT EXISTS` inválido foi substituído por blocos `DO $$` com consulta a `pg_constraint`. |
| Normalização de índices legados | **IMPLEMENTADO E PROVADO** | Commit `2fe7da5`; migration `20260821110000_normalize_legacy_index_names` | 26 nomes de índices históricos foram normalizados para o schema canônico; operação de metadata, sem dados. |
| Reconciliação do drift do schema histórico | **IMPLEMENTADO E PROVADO NO BANCO EFÊMERO** | Commit `58cbe02`; migration `20260821120000_reconcile_historical_schema_drift`; job `prisma-postgresql` verde | A migration contém diferenças históricas de enums, defaults, constraints, índices, colunas e tabela `Fornecedor`; **não deve ser aplicada em produção sem revisão e autorização humana explícitas**. |
| Migration SaaS aditiva | **IMPLEMENTADO E PROVADO** | Commit `8f16742`; migration `20260821100000_add_tenant_framework_content_models` | Seis modelos, índices, uniques e FKs presentes; nenhuma operação de produção foi executada. |
| PII fora da imagem e dos artifacts | **IMPLEMENTADO E PROVADO** | `.dockerignore`, scanner de artifacts; jobs `privacy` e `artifacts` verdes | Nenhuma reescrita ou remoção do histórico Git foi feita; o risco P0-2 permanece documentado. |
| OpenAPI gerado | **IMPLEMENTADO E PROVADO** | `generate-openapi.ts`; job `openapi-contracts` verde | 254 operações documentadas. |
| Chamadas HTTP do frontend contra OpenAPI | **IMPLEMENTADO E PROVADO** | `validate-openapi.mjs`; job `openapi-contracts` verde | 405 chamadas verificadas sem divergência. |
| Testes API | **IMPLEMENTADO E PROVADO** | Job `api-tests` verde | Suíte local consolidada: 36 suítes e 271 testes; o CI também executou `test-migrate-deploy`. |
| Testes frontend | **IMPLEMENTADO E PROVADO** | Job `web-tests` verde | 2 arquivos e 7 testes Vitest aprovados. |
| E2E crítico de navegador | **IMPLEMENTADO E PROVADO** | Job `e2e` verde | Cenário crítico do PWA desktop aprovado no runner. |
| Bundle, gzip e precache | **IMPLEMENTADO E PROVADO** | Job `bundle-pwa-budget` verde | Evidência local anterior: 3.266.086 bytes bruto, 632.403 gzip e 4.334.580 bytes de precache, dentro dos limites definidos. |
| API, web e site compilam | **IMPLEMENTADO E PROVADO** | Job `builds` verde | Os três artefatos compiláveis passaram no runner. |
| Containers e smoke não destrutivo | **IMPLEMENTADO E PROVADO** | Job `containers-smoke` verde | Imagens da API e web foram construídas e os comandos de smoke passaram. |
| SBOM e licenças | **IMPLEMENTADO E PROVADO** | Job `sbom-licenses` verde | SBOM produzido pelo runner sem falha. |
| Instalação reproduzível | **IMPLEMENTADO E PROVADO** | Job `install` verde | Lockfile e instalação workspace passaram. |
| Lint do repositório/workflow | **IMPLEMENTADO E PROVADO** | Job `lint` verde; YAML lint local | Nenhum bloqueio de lint no commit final. |
| Merge, migration e deploy de produção | **NÃO EXECUTADOS — CORRETO** | Estado do PR `OPEN`, merge status `CLEAN` | Requerem revisão e autorização humana explícitas; não foram executados nesta tarefa. |

## Correções finais incorporadas

O primeiro bloqueio do runner era a inconsistência histórica entre as tabelas PascalCase criadas pela migration inicial e os nomes lowercase usados por migrations posteriores. A fixture agora cria, antes da migration `20260223000000`, os stubs estruturais `child`, `classroom`, `unit` e `mantenedora`, removendo-os com `CASCADE` após a faixa histórica e antes das migrations posteriores. As tabelas canônicas PascalCase não são removidas pela fixture.

O segundo bloqueio era a sintaxe `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS` na migration `20260420010000`, inexistente no PostgreSQL. A migration foi corrigida de modo idempotente, usando verificações em `pg_constraint` antes de adicionar cada relação. Em seguida, o drift revelou nomes de índices e uma reconciliação histórica mais ampla; as migrations `20260821110000` e `20260821120000` foram acrescentadas para tornar o estado canônico reproduzível no banco efêmero do CI.

## Execuções remotas

| Execução | Commit | Resultado | Link |
|---|---|---|---|
| `32453168092` — run #16 | `ca8bfbe` | **SUCCESS — HEAD documental validado** | [abrir execução final](https://github.com/vml-arquivos/zellare-saas/actions/runs/32453168092) |
| `32452784952` — run #15 | `58cbe02` | **SUCCESS — 14/14 jobs verdes** | [abrir execução técnica](https://github.com/vml-arquivos/zellare-saas/actions/runs/32452784952) |
| `32452220722` — run #14 | `2fe7da5` | Falhou apenas no drift histórico antes da reconciliação final | [abrir execução intermediária](https://github.com/vml-arquivos/zellare-saas/actions/runs/32452220722) |

## Riscos residuais e decisão operacional

O risco **P0-2** permanece: existem artifacts/PII no histórico Git legado. O Gate 0.2 adiciona scanner, allowlist e `.dockerignore`, mas não reescreve histórico nem remove arquivos sem aprovação humana explícita. Essa decisão foi mantida para evitar uma operação irreversível.

A migration `20260821120000_reconcile_historical_schema_drift` foi necessária para a prova de reprodutibilidade no PostgreSQL efêmero, mas contém alterações de schema além da simples criação dos seis modelos SaaS. Portanto, o fato de o CI estar verde **não equivale a autorização para aplicá-la na base de produção**. Antes de qualquer migration de produção, deve haver revisão humana da SQL, backup verificável, janela operacional e confirmação explícita.

O deploy/redeploy do Coolify não foi executado por esta tarefa. O ambiente de produção permanece no último commit anteriormente publicado, `08f3356`, até que o PR seja revisado, mergeado manualmente e o redeploy seja autorizado e executado pelo responsável operacional. A atualização posterior da própria matriz é documental e não altera rotas, banco ou runtime. O Conexa/COCRIS permanece sem alterações.

## Próxima decisão humana

O PR [#12](https://github.com/vml-arquivos/zellare-saas/pull/12) está **aberto e com estado de merge `CLEAN`**. A sequência recomendada é revisar especificamente a migration de reconciliação, confirmar o plano de backup e somente então realizar o merge manual. Depois do merge, o redeploy deve ser feito manualmente no Coolify, com monitoramento de logs e sem executar migration de produção fora da janela autorizada.

### Referências

[1]: https://github.com/vml-arquivos/zellare-saas/pull/12 "PR #12 do Zelare"

[2]: https://github.com/vml-arquivos/zellare-saas/actions/runs/32452784952 "Execução final verde do Gate 0.2"

[3]: https://github.com/vml-arquivos/zellare-saas/tree/fix/zelare-gate-0-2-20260821 "Branch corretiva do Gate 0.2"
