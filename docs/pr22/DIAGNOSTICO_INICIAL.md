# PR22 — diagnóstico e parecer

## Baseline e escopo

A PR22 parte do `main` em `205ed92ca3f19172375879650f3029a571b93553`, merge da PR21, no branch `feat/zelare-pr22-demo-readiness-20260822`. O trabalho é exclusivamente Zelare. Conexa/COCRIS não foi aberto para alteração, não recebeu commit, migration, deploy ou operação.

A PR21 permanece como contrato protegido: Journey flag desligada por padrão, capability/RBAC server-side, escopo tenant/unidade/turma, IDOR, consentimento e base legal, HMAC versionado, AES-GCM, mascaramento, retenção/revogação/eliminação, auditoria/outbox e máquina de estados. Oferta aceita continua criando apenas `JourneyEnrollmentDraft` incompleto.

## Auditoria inicial

A home pública, login, dashboard do professor, Família/LGPD, Configurações e Meu Perfil carregaram em auditoria somente leitura. O dashboard observado em produção tinha estado de demonstração esparso; o campo visual de perfil continha identificadores pessoais não verificáveis como sintéticos e, por isso, não foi copiado, alterado ou usado.

A tentativa de abrir `/app/journey` com professor foi redirecionada ao dashboard, sem erro de aplicação. Família/LGPD inicialmente exibiu estado vazio recuperável; após seleção de criança autorizada, mostrou privacidade aplicada, consentimento ativo, diário, observação e mensagens protegidas.

## Causas-raiz confirmadas

A causa-raiz principal da baixa prontidão demonstrativa era o entrypoint `db:seed`/`seed:synthetic` ser deliberadamente no-op. Um banco novo não recebia massa coerente para Journey, presença, planejamento, Família e indicadores. A correção foi uma fixture PR22 separada e explícita, sem alterar o comportamento seguro do seed padrão.

O segundo problema era um contrato incompleto no resumo de insights: o serviço selecionava `planning.classroomId`, mas não retornava o identificador em `planejamentoAtivo`, embora o frontend o usasse para abrir o Diário. A PR22 adicionou o campo e um teste unitário específico.

Durante a aceitação humana de uma oferta foi identificado um terceiro problema localizado: `AuthService` declarava a capability `journey.offer.accept` para `STAFF_CENTRAL_ADMISSOES`, mas `JourneyAccessService` não a honrava e respondia 403. O guard passou a reconhecer a capability já existente, sem conceder acesso a professor ou coordenação pedagógica; o teste unitário fixa o contrato.

O quarto problema foi de contrato de UI: o painel de visita aceitava texto livre para o responsável, mas o backend valida um identificador interno. O frontend agora envia o ID do usuário autenticado e exibe o responsável em modo somente leitura, coberto por teste.

## Entrega sintética

`apps/api/scripts/fixtures/pr22-demo-seed.mjs` cria com IDs fixos e `upsert` uma mantenedora, unidade, turma, perfis sintéticos, professor, família, quatro crianças/matrículas, planejamento, presença, diário, desenvolvimento, consentimento/vínculo familiar, mensagem protegida, sete prospects Journey, políticas, visitas, ofertas em estados variados, um draft incompleto, atividades, tarefas e revisão de duplicidade.

A fixture exige confirmação explícita, rejeita produção, restringe host de banco e exige senha/segredos em runtime. Não contém `deleteMany`, `updateMany`, DROP, TRUNCATE, SQL bruto ou plaintext de contato Journey. Aplicação e reaplicação no banco demo passaram sem duplicação; após as mutações humanas, o banco confirmou `Child=4`, `Enrollment=4`, oferta `ACEITA` e draft `INCOMPLETA`.

## Evidências finais

A demonstração humana percorreu login, Journey nas sete abas, captação com consentimento, alteração de estágio, agendamento, presença, lista de espera, oferta, aceite e reload. A área Família enviou a mensagem sintética `Atualização PR22`; após reload, a seleção autorizada da criança fez a comunicação reaparecer.

O Playwright autenticado passou em 320, 360, 390, 412, 768 e 1280 px, verificou ausência de overflow horizontal, percorreu as sete abas, comprovou cadastro/reload e gerou screenshots, vídeo, console `CLEAN` e HAR sanitizado sem credenciais. O professor recebeu 403 no endpoint `/journey/units` e foi redirecionado na rota Journey.

## Bloqueio de baseline

Não há migration PR22. `prisma validate` passou, mas o replay histórico desde zero em banco PostgreSQL 16 novo falhou na migration `20260223000000_sala_virtual_recados_observacoes`, linhas 57–73: ela executa `ALTER TABLE "development_observation"` e cria índices/FK sem que a tabela exista em qualquer migration anterior. O `migrate diff` com shadow repetiu `P3006/P1014`. O problema é anterior à PR22 e foi mantido intacto para evitar improviso histórico.

O lint focalizado, typechecks, contracts, testes unitários, E2E autenticado, builds, budget e scanner de artefatos passaram. Lint global API/web permanece bloqueado por dívida legada, respectivamente 188 e 832 problemas, sem correção ampla nesta PR.

## Parecer

A demo local autorizada está coerente, persistente e protegida pelos controles da PR21. A PR22 é tecnicamente auditável e limitada, porém o replay de migrations desde zero e o lint global não estão verdes. O parecer objetivo é **NO-GO para merge e deploy** até decisão específica sobre esses bloqueios. Não há autorização para produção, Conexa/COCRIS ou ativação global da flag.
