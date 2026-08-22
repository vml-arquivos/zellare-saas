# PR22 — matriz final de evidências

> **Estado:** `NO-GO PARA MERGE/DEPLOY` nesta etapa. A demonstração sintética foi comprovada, mas o replay integral de migrations históricas falha antes da Onda 3 e o lint global possui dívida legada fora do escopo. A PR22 não fez merge, deploy, migration ou operação em produção.

## Matriz rota → ação → request → persistência → resultado

| Rota/área | Ação humana ou automatizada | Request/status observável | Persistência/reload | Console | Resultado comprovado |
|---|---|---|---|---|---|
| Site público | Abrir home | GET público carregado | N/A | Sem erro na amostra | Home, navegação, recursos e planos renderizados em auditoria somente leitura; nenhum dado foi copiado |
| Login | Abrir formulário e autenticar perfis sintéticos | GET + POST de login local; autenticação concluída | Sessões alternadas no preview local | Sem erro de aplicação | Admissões, professor e família autenticaram com contas `.invalid` |
| Dashboard professor | Abrir painel local | Redirect para `/app/teacher-dashboard?unitId=pr22-demo-unit` | Leitura confirmada | Sem erro de aplicação | Turma Descobertas, 4 crianças, 1 registro pedagógico, planejamento semanal e chamada/diário carregados |
| Insights/Diário professor | Abrir Desenvolvimento e Diário | Rota de diário recebeu `classroomId=pr22-demo-classroom` | N/A | Sem erro de aplicação | Desenvolvimento mostrou evidências do Diário; calendário e formulário carregaram; sábado foi bloqueado corretamente como não letivo |
| Família/LGPD | Abrir timeline, selecionar Lumi e enviar mensagem sintética | POST de mensagem protegida concluído pela UI | Reload → estado vazio até selecionar criança → `Atualização PR22` reapareceu | Sem erro de aplicação | Banner de privacidade, consentimento ativo, diário, observação e comunicação protegida persistiram |
| Journey/Visão geral | Login admissões e abrir aba | GET `/journey/dashboard?unitId=pr22-demo-unit` retornou 200 no diagnóstico local | Reload preservou contadores | `CLEAN` no Playwright | 8 interessados após cadastro humano, 1 visita futura, 2 na espera e 1 oferta ativa após aceite |
| Journey/Interessados | Criar Dara Demo PR22 com criança `.invalid`, consentimentos marcados | POST de captação concluído; a primeira tentativa sem checkbox foi bloqueada pelo browser | Reload → Dara apareceu primeiro na lista | Console limpo após sucesso | Ação → validação de consentimento → resposta `Interessado cadastrado.` → persistência confirmada |
| Journey/Interessados | Alterar estágio de Dara | PATCH de estágio concluído pela UI | Reload posterior manteve o fluxo da prospecto | Sem erro observado | Transição `NOVO → CONTATADO` confirmada com mensagem `Estágio atualizado` |
| Journey/Visitas | Agendar e confirmar presença de Dara | Primeiro payload com responsável textual foi rejeitado; correção passou a enviar `User.id`; novo POST concluiu | Reload → visita permaneceu `REALIZADA` | Sem erro de aplicação | `AGENDADA → REALIZADA`, contador futuro e evento persistidos; correção coberta por teste de painel |
| Journey/Lista de espera | Vincular Dara a política publicada v1 | POST concluído pela UI | Reload → Dara permaneceu com 90 pontos e explicação | Sem erro de aplicação | Política vigente, prioridade explicável e vínculo persistidos |
| Journey/Ofertas | Criar oferta para Dara na Turma Descobertas | POST concluído pela UI | Reload → oferta apareceu `OFERTADA` | Sem erro de aplicação | Oferta criada sem override, expiração futura, capacidade real respeitada |
| Journey/Ofertas | Aceitar oferta de Dara | Primeira tentativa retornou 403 por inconsistência RBAC; após correção do guard, PATCH concluiu | Reload → `ACEITA`; oferta ativa caiu de 2 para 1 | Sem erro de aplicação | Mensagem `Oferta aceita; rascunho incompleto criado.`; DB confirmou draft `INCOMPLETA` e nenhum Child/Enrollment novo |
| Journey/RBAC negativo | Professor acessar `/app/journey` e `/journey/units` | Rota redirecionou para dashboard; GET local retornou HTTP 403 `Forbidden resource` | N/A | Somente aviso esperado de acesso negado | Coordenação pedagógica/professor não receberam acesso indevido ao Journey |
| Browser E2E | Login admissões, sete abas, cadastro e reload | Playwright passou 1/1; HAR sanitizado preserva requests/statuses | Reload do cadastro passou | `CLEAN` | Viewports 320, 360, 390, 412, 768 e 1280 px sem overflow horizontal; 6 screenshots e vídeo gerados |
| CI oficial PR22 | Executar workflow no novo HEAD | 14/14 checks successful no workflow oficial da PR | N/A | N/A | Nenhum job cancelado/falho; run e SHA finais são registrados na PR e no parecer de entrega |

## Artefatos preservados

Os artefatos da execução responsiva estão fora do Git, no diretório `/home/ubuntu/research_zelare/onda3_journey_20260822/pr22-playwright-final/`. O conjunto contém `journey-overview-320.png`, `journey-overview-360.png`, `journey-overview-390.png`, `journey-overview-412.png`, `journey-overview-768.png`, `journey-overview-1280.png`, `journey-reports-768.png`, `journey-console.log` com `CLEAN` e `journey-responsive-sanitized.har`. O HAR bruto foi apagado após a sanitização; a verificação final encontrou zero JWT Bearer e zero ocorrência da senha de runtime.

Os logs integrais finais ficam em `/home/ubuntu/research_zelare/onda3_journey_20260822/final-logs/`, incluindo o E2E API, build web, budget, lint web, validação Prisma e o diagnóstico de invocação inicial do Jest. O vídeo Playwright `journey-responsive.webm` pertence ao mesmo run aprovado. O trace da falha de seletor anterior não faz parte do pacote final; a execução corrigida passou.

## Dados sintéticos e privacidade

A fixture PR22 usa IDs estáveis com prefixo `pr22-demo`, nomes marcados como `Demo`, e-mails `.invalid` e contatos Journey armazenados somente como HMAC versionado e AES-GCM. O seed padrão continua sem inserir dados. A senha é fornecida exclusivamente por variável de ambiente no momento da execução, não aparece na fixture, no Git, na documentação ou no HAR final.

A consulta read-only ao banco demo confirmou `JourneySeatOffer=ACEITA`, um draft `INCOMPLETA` para a oferta de Dara e contagens globais `Child=4` e `Enrollment=4`. Nenhuma matrícula definitiva foi criada pelo aceite. Não houve uso, mutação ou exportação de dados do ambiente público.

## Migrations, lint e escopo

A PR22 não adiciona migration. `prisma validate` passou. O replay desde zero em PostgreSQL 16 descartável falhou na migration histórica `20260223000000_sala_virtual_recados_observacoes`, linhas 57–73, que executa `ALTER TABLE "development_observation"` embora nenhuma migration anterior crie essa tabela; o `migrate diff` com shadow reproduziu `P3006/P1014`. Esse conflito é anterior à PR22 e não foi improvisadamente alterado.

O lint focalizado dos arquivos Journey alterados passou, assim como contracts, typecheck, unitários, builds e budget. O lint global do web apresentou 832 problemas legados e o lint API incluindo `insights.service.ts` apresentou 188 violações Prettier legadas; não foi feito refactor amplo para mascarar a dívida.

## Parecer

O caminho demonstrável local é funcional e persistente, com RBAC/LGPD preservados após a correção mínima do aceite para admissões centrais. O parecer operacional desta etapa permanece **NO-GO para merge/deploy** até uma decisão separada sobre o baseline de migrations e a política de lint global. Nenhuma conclusão de produção é inferida a partir do preview local.
