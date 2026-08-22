# PR22 — changelog final

## Baseline

A PR22 parte do merge da PR21 em `main`, commit `205ed92ca3f19172375879650f3029a571b93553`, no branch `feat/zelare-pr22-demo-readiness-20260822`. O problema central era a ausência de massa coerente para demonstração: o seed sintético padrão era deliberadamente no-op. Nenhuma alteração foi feita no Conexa/COCRIS.

## Alterações de código

| Arquivo | Alteração | Motivo |
|---|---|---|
| `apps/api/scripts/fixtures/pr22-demo-seed.mjs` | Fixture demo/teste somente-upsert, protegida por ambiente, confirmação e banco sintético | Criar massa reproduzível de demonstração sem operações destrutivas |
| `apps/api/package.json` | Novo script explícito `seed:demo` | Impedir que o seed padrão crie dados implicitamente |
| `apps/api/scripts/README.md` | Contrato seguro da fixture e guardrails | Documentar execução autorizada sem senha/segredo versionado |
| `apps/api/scripts/check-sensitive-artifacts.mjs` | Allowlist explícita do domínio reservado `demo.invalid` | Permitir logins sintéticos PR22 sem reduzir a detecção de e-mails não reservados |
| `apps/api/src/insights/insights.service.ts` | Retorno de `classroomId` em `planejamentoAtivo` | Corrigir contrato já consumido pelo botão de abertura do Diário |
| `apps/api/src/insights/insights.service.spec.ts` | Teste do campo `classroomId` | Prevenir regressão do caminho professor → Diário |
| `apps/api/src/journey/journey-access.service.ts` | `STAFF_CENTRAL_ADMISSOES` passa a honrar `journey.offer.accept`, capability já declarada no AuthService | Corrigir 403 inconsistente no aceite sem ampliar acesso de professor/pedagogia |
| `apps/api/src/journey/journey-access.service.spec.ts` | Asserção de aceite para admissões centrais e ausência de capabilities elevadas | Fixar o contrato RBAC granular |
| `apps/web/src/pages/JourneyActionPanels.tsx` | Responsável da visita usa ID do usuário autenticado e campo somente leitura | Evitar texto livre inválido e manter atribuição server-side |
| `apps/web/src/pages/JourneyPage.tsx` | Passa o ID do usuário autenticado ao painel de visitas | Completar o contrato frontend/backend |
| `apps/web/src/pages/JourneyActionPanels.test.tsx` | Cobertura do payload de visita e presença confirmada | Prevenir regressão funcional da ação |
| `apps/web/e2e/journey-responsive.spec.ts` | Seletores estritos para campos e viewport desktop 1280 px | Evitar ambiguidade de labels e comprovar reflow desktop além de 320/360/390/412/768 |

## Documentação e evidências

| Arquivo | Conteúdo |
|---|---|
| `docs/pr22/DIAGNOSTICO_INICIAL.md` | Baseline, causas-raiz, escopo e riscos |
| `docs/pr22/PLANO_EXECUCAO.md` | Ordem, critérios de saída e guardrails |
| `docs/pr22/EVIDENCIAS.md` | Matriz final rota → ação → request → reload → confirmação |
| `docs/pr22/REGRESSION_REPORT.md` | Gates, passes, bloqueios históricos e parecer |
| `docs/pr22/DEPLOY_REPORT.md` | Registro de não-deploy e procedimento futuro condicionado a autorização |
| `docs/pr22/DEMO_RUNBOOK.md` | Runbook com contas `.invalid`, sem senha em texto |
| `docs/pr22/CHANGELOG.md` | Este inventário |

## Preservado

A PR22 não cria domínio paralelo, não altera migrations, não ativa Journey globalmente, não transforma oferta aceita em matrícula definitiva, não mexe em Conexa/COCRIS e não altera os guardrails de consentimento, base legal, HMAC versionado, AES-GCM, mascaramento, retenção, revogação, eliminação, auditoria, outbox, isolamento ou máquina de estados da PR21.

## Status

Fixture, demonstração humana, E2E autenticado, testes unitários, typechecks, contratos, builds, budget e scanner de privacidade passaram. O replay integral de migrations falha em migration histórica anterior à PR22 e o lint global mostra dívida legada; por isso o status operacional final é `NO-GO PARA MERGE/DEPLOY` até decisão separada sobre esses gates.
