# PR22 — relatório final de regressão

## Escopo e proteção

A PR22 parte do `main` pós-PR21 no commit `205ed92ca3f19172375879650f3029a571b93553`, no branch `feat/zelare-pr22-demo-readiness-20260822`. O escopo permaneceu exclusivamente Zelare. Não houve alteração no Conexa/COCRIS, merge em `main`, deploy, migration ou mutação de produção.

A feature flag `journey_admissions_v1` continua desligada por padrão no código. A fixture demo exige confirmação explícita, ambiente não produtivo, banco local/CI/domínio sintético e segredos fornecidos em runtime. Ela usa somente `upsert`, não executa `deleteMany`, `updateMany`, DROP, TRUNCATE ou SQL bruto, e não grava contatos Journey em plaintext.

## Correções entregues

A causa raiz principal da baixa prontidão era o seed sintético padrão ser no-op. A PR22 adicionou `apps/api/scripts/fixtures/pr22-demo-seed.mjs`, o script explícito `seed:demo` e documentação de guardrails. A fixture cria massa coerente para mantenedora, unidade, turma, perfis, crianças, matrículas, presença, planejamento, diário, desenvolvimento, consentimento/vínculo familiar, mensagens protegidas e Journey completo.

O serviço de insights já selecionava `planning.classroomId`, mas o payload `planejamentoAtivo` não o devolvia. A PR22 incluiu esse campo e o teste unitário correspondente. Durante a demonstração surgiu uma inconsistência adicional: AuthService anunciava `journey.offer.accept` para `STAFF_CENTRAL_ADMISSOES`, mas `JourneyAccessService` devolvia 403. A correção mínima alinhou o guard à capability já declarada e adicionou asserção unitária; nenhuma capability foi concedida a professor ou coordenação pedagógica.

O painel de visitas deixou de aceitar texto livre para o responsável e passou a enviar o ID interno do usuário autenticado, evitando rejeição de payload e mantendo o campo somente leitura. O teste focalizado do painel cobre o request corrigido.

## Gates executados

| Gate | Resultado | Evidência |
|---|---|---|
| Fixture PR22 em banco demo novo | PASS | Aplicação e reaplicação concluídas; 7 prospects iniciais, 4 Children, 4 Enrollment e 1 draft antes da mutação humana |
| Persistência humana Journey | PASS | Captação, estágio, visita, confirmação, espera, oferta e aceite com reload; banco confirmou draft incompleto |
| Família/LGPD | PASS | Timeline protegida, consentimento/vínculo ativo, mensagem sintética enviada e reaparecida após reload |
| RBAC negativo | PASS | Professor redirecionado de `/app/journey`; `/journey/units` retornou 403 server-side |
| API unitários | PASS | 49 suites, 359 testes |
| API E2E autenticado | PASS | 2 suites, 9 testes, com config dedicada `apps/api/test/jest-e2e.json` |
| API typecheck | PASS | `pnpm --filter @zelare/api typecheck` |
| API lint focalizado | PASS | Arquivos Journey alterados sem erro |
| Web unitário focalizado | PASS | `JourneyActionPanels.test.tsx`: 2 testes |
| Web lint focalizado | PASS | JourneyActionPanels, JourneyPage e E2E responsive |
| Web contracts/typecheck | PASS | 228 arquivos de contrato; `tsc -b` |
| Web E2E responsivo | PASS | 1 teste; 320, 360, 390, 412, 768 e 1280 px; sem overflow; console `CLEAN` |
| Segurança de artefatos | PASS | 1076 arquivos versionados; zero conteúdo sensível detectado |
| API build/OpenAPI | PASS | Build concluído; OpenAPI com 332 rotas |
| Web build/PWA | PASS | Build concluído; PWA gerado |
| Bundle/PWA budget | PASS | Limites de JS inicial e precache respeitados |
| Prisma validate | PASS | Schema válido |
| CI oficial PR22 | PASS | Run `32590927240`; 14/14 checks successful no SHA `416b2424adea62c6c2849a26194178952180b848` |
| Replay migrations desde zero | BLOCKED | Migration histórica `20260223000000_sala_virtual_recados_observacoes` falhou com `42P01` em `development_observation` |
| Prisma migrate diff com shadow | BLOCKED | Reproduziu `P3006/P1014` pela mesma tabela histórica inexistente |
| Lint global API/web | BLOCKED BASELINE | 188 problemas API com `insights.service.ts` incluído; 832 problemas web, predominantemente Prettier/any/unused-vars legados |

A primeira invocação do E2E API sem a configuração dedicada produziu `No tests found`, pois o Jest unitário limita-se a `src/**/*.spec.ts`. Esse erro de invocação foi corrigido sem alterar código e a execução correta passou integralmente; o log foi preservado como `api-journey-e2e-invocation-failure.log` para rastreabilidade.

## Migrations e drift

Nenhuma migration foi criada ou alterada pela PR22. O replay em banco PostgreSQL 16 descartável novo aplicou migrations até `20260221000000_diary_event_curriculum_optional` e falhou na migration seguinte, que nas linhas 57–73 executa `ALTER TABLE "development_observation"` e cria índices/FK sem que a tabela exista no histórico anterior. O `migrate diff` usando shadow database confirmou o mesmo bloqueio. O banco de demo foi construído com `prisma db push` sem `--force-reset`; nenhum banco real foi resetado.

Esse bloqueio é um problema do baseline histórico anterior à PR22. A PR22 não o corrigiu por adição improvisada, pois fazê-lo exigiria uma decisão específica de reconciliação histórica e poderia ampliar o escopo. Por isso, o gate de replay permanece bloqueado e impede declarar GO para merge/deploy.

## Privacidade e regressão funcional

Os dados de demonstração são marcados por `.invalid`, prefixo `pr22-demo` e nomes `Demo`. Contatos Journey são armazenados somente como HMAC versionado/AES-GCM; respostas da API mascaram os campos e não devolvem hash/ciphertext. Consentimentos, base legal, retenção, revogação, eliminação, auditoria, outbox, isolamento e máquina de estados da PR21 foram preservados.

O aceite de oferta confirmou apenas `JourneyEnrollmentDraft` com status `INCOMPLETA` e campos faltantes. Após o aceite de Dara, o PostgreSQL continuou com `Child=4` e `Enrollment=4`; não houve matrícula definitiva, contrato, cobrança, pagamento ou nova criança criada.

## Parecer

A implementação e a demonstração sintética ponta a ponta estão comprovadas, e as alterações de código são localizadas. O CI oficial do novo HEAD concluiu 14/14 checks verdes no run `32590927240`. Contudo, o replay integral de migrations desde zero e os lints globais permanecem gates não verdes por problemas preexistentes. O status objetivo é **NO-GO para merge e deploy nesta PR22**. Não há autorização para operação em produção; qualquer tratamento do baseline de migrations ou da dívida de lint deve ocorrer em trabalho separado e explicitamente autorizado.
