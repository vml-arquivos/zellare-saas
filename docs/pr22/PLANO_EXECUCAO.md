# PR22 — plano de execução e status

## Objetivo

Deixar o Zelare demonstrável em ambiente de teste autorizado, usando a arquitetura existente e dados inequivocamente sintéticos, sem produção real, sem Conexa/COCRIS e sem regressão das garantias das PR20 e PR21.

## Ordem operacional e resultado

| Fase | Execução | Resultado | Critério de saída |
|---|---|---|---|
| 1 | Auditoria humana de site, login, dashboard, menus, Família, Journey, configurações, desktop e mobile | PASS | Estado vazio, erro, console e rotas registrados; produção não mutada |
| 2 | Branch exclusiva e inventário de escopo | PASS | `main` em `205ed92`; branch PR22 criada sem alterar `main` |
| 3 | Fixture de demonstração | PASS | Seed explícito somente-upsert, confirmação/host/ambiente protegidos, sem plaintext de contato |
| 4 | Correções localizadas | PASS | `classroomId`, capability de aceite já declarada e responsável por ID interno; sem refactor amplo |
| 5 | Validação sintética | PASS PARCIAL | Banco demo novo, `db push` sem reset, fixture aplicada/reaplicada; replay histórico bloqueado por baseline |
| 6 | Demonstração humana | PASS | Login, sete abas Journey, captação, estágio, visita, presença, espera, oferta, aceite, Família/mensagem e reload |
| 7 | Gates | PASS PARCIAL | Unitários, E2E, typecheck, contracts, builds, budget, scanner e responsive passaram; migrations/lint global bloqueados |
| 8 | Revisão e PR | EM EXECUÇÃO | Diff, docs, evidências, commit e PR serão concluídos; merge/deploy proibidos nesta PR22 |

## Guardrails

O seed padrão permanece no-op. A fixture PR22 exige `ALLOW_SYNTHETIC_SEED=true`, `DEMO_DATA_CONFIRMATION=PR22-DEMO-ONLY`, `NODE_ENV` diferente de production, senha e segredos fornecidos no momento da execução e banco local/CI/domínio sintético. Nenhum valor de senha ou segredo será versionado.

Não serão executados `DROP`, `TRUNCATE`, exclusões gerais, limpeza de Redis, destruição de volumes ou migration em produção. A PR22 não altera migrations históricas. A flag `journey_admissions_v1` continua desligada por padrão no código e só foi usada no tenant sintético dos testes locais.

## Critério de parada

Qualquer falha funcional, de persistência, isolamento, segurança, responsividade, console, build ou gate impede `GO` e merge. O critério foi aplicado: a migration histórica `20260223000000_sala_virtual_recados_observacoes` falhou desde zero pela tabela `development_observation` inexistente no histórico, e o lint global apresenta dívida legada. O bloqueio está documentado; não houve alteração improvisada para mascará-lo.
