# Matriz de entrada — Zelare Onda 1 Evidence Loop + Family Circle

**Branch:** `feat/zelare-onda1-evidence-family-20260821`
**SHA-base:** `3bae08f9b2e2bcaccb44c01df4a2979dda8ec9cd`
**Regra:** nenhum merge, migration ou deploy de produção nesta onda sem PR verde e autorização humana explícita.

## Gate de entrada

| Gate | Evidência atual | Estado de entrada | Próxima prova |
|---|---|---|---|
| PWA móvel e recuperação | `pwaEligibility`, `PwaRuntime`, política Nginx e testes Vitest | IMPLEMENTADO E PROVADO no Gate 0.2 | ampliar E2E da Onda 1 sem alterar o contrato mobile-only |
| PII/artifacts | scanner, `.dockerignore`, SBOM e workflow | IMPLEMENTADO E PROVADO no Gate 0.2 | repetir scans no PR da Onda 1 e no ZIP final |
| Prisma/migrations SaaS | 44 migrations, migration SaaS aditiva, drift zero e CI PostgreSQL | IMPLEMENTADO E PROVADO no Gate 0.2 | nova migration expand-only da Onda 1 em PostgreSQL vazio/legado |
| Urgência operacional | `AlertaOperacional` com canal/prioridade e projeção em `ChildEvidence` | IMPLEMENTADO E PROVADO como fundação | expor contrato separado `operationalUrgency` na nova API |
| Configurações/Usuários | seleção explícita, RBAC por escopo e bloqueio de callers fantasmas | IMPLEMENTADO E PROVADO no Gate 0.2 | capabilities específicas da Onda 1 e testes multipapel |
| OpenAPI, testes, CI | OpenAPI, contratos, testes web, E2E, builds, smoke e 14 gates | IMPLEMENTADO E PROVADO no Gate 0.2 | cobrir novas rotas/modelos da Onda 1 |
| Release compatível | API, web e site publicados no mesmo `main@3bae08f`; health/smoke 200 | IMPLEMENTADO E PROVADO no fechamento do Gate 0.2 | incluir release nas novas respostas sem expor dados |
| Banco vazio/pendente/rollback | reprodução local e backup de produção documentados | IMPLEMENTADO E PROVADO no Gate 0.2 | repetir somente para a migration nova, sem `migrate resolve` no fluxo normal |

## Mapa requisito → âncora → lote

| Requisito da Onda 1 | Âncora atual | Lote planejado | Critério de aceite |
|---|---|---|---|
| Projeção rastreável | `EvidenceService`/`ChildEvidence` | A/B | fonte preservada, upsert idempotente, proveniência presente |
| Review Hub | `EvidenceService.review` | B | estados, versão, responsável, SLA, auditoria e transições válidas |
| Objetivos e suportes | `Planning`, `CurriculumMatrix`, `ChildEvidence` | C | vínculo sem cópia, resposta observada e fechamento |
| Urgência separada | `AlertaOperacional`/metadados | B | contrato `operationalUrgency` separado de `longitudinalSignals` |
| Family Circle | `FamilyService`, `ChildGuardian`, `FamilyCommunication` | D | vínculo ativo, snapshot autorizado, contribuição própria e adapter legado |
| Consentimento | `ChildGuardian.consentAt` | D | ledger por finalidade, versão, vigência e revogação |
| Mídia privada | storage existente a confirmar por rota | D | URL assinada/metadata, sem link público e sem PII em log |
| IA governada | módulos AI/IA assistiva existentes | E | regras internas primeiro, fonte/versão, revisão humana e kill switch |
| Painéis | `TimelineCriancaPage`, dashboards atuais | F | UI não órfã, flags desligadas, estados de carregamento/erro/vazio |
| Observabilidade | Audit/metrics atuais | G | correlação, métricas, runbook e smoke sem PII |

## Condições de parada

A implementação para imediatamente se ocorrer falha de typecheck, teste, build, OpenAPI, contrato, PII/secret scan, drift, isolamento tenant/unidade/criança, regra de vínculo familiar, preservação de `diagnosticInference: false`/`humanReviewRequired: true`, incompatibilidade de mensagem legada, operação destrutiva ou qualquer alteração detectada no Conexa.

## Escopo desta primeira execução

O primeiro lote de código será limitado a contratos internos, flags desligadas, capabilities e modelos aditivos essenciais para revisão/objetivos/família. O restante da Onda 1 será entregue em lotes subsequentes na mesma branch, cada um com seus testes e evidências. Nenhum backfill, seed ou alteração de dados reais será executado automaticamente.

## Referências

[1]: ./GATE02_ACCEPTANCE_MATRIX_2026-08-21.md "Matriz de aceite do Gate 0.2"
[2]: ../architecture/ONDA1_ADRS_2026-08-21.md "ADRs da Onda 1"
[3]: https://www.unicef.org/innocenti/reports/policy-guidance-ai-children "UNICEF — Guidance on AI and children"
[4]: https://www.cdc.gov/act-early/about/developmental-monitoring-and-screening.html "CDC — Developmental Monitoring and Screening"
