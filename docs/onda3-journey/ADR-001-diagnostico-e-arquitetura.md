# ADR-001 — Zelare Journey: diagnóstico e arquitetura da primeira fatia

**Status:** aceito para implementação nesta branch, sem ativação por padrão
**Autor:** Manus AI
**Data:** 2026-08-22
**Branch:** `feat/zelare-onda3-journey-20260822`
**SHA inicial:** `196e7f2deb37b030051b3088b0c4452fe7eec17f`
**`origin/main` no início:** `196e7f2deb37b030051b3088b0c4452fe7eec17f`
**PR #20:** confirmada mergeada; não será reaberta nem alterada.

## 1. Escopo exato da decisão

Esta implementação cobre somente a primeira fatia vertical **Zelare Journey — Captação, Visitas, Lista de Espera e Oferta de Vaga**. O resultado será um módulo aditivo e isolado por organização que registra interessados prospectivos, acompanha o funil, agenda visitas, mantém lista de espera com política versionada e explicável, oferta reservas temporárias de vagas reais e, após aceite, cria apenas um rascunho incompleto de solicitação de matrícula.

Ficam explicitamente fora desta branch a criação de `Child` ativo, `Enrollment` ativo, vínculo `ChildGuardian` canônico, matrícula definitiva, contratos, assinaturas, documentos de matrícula, consentimentos de matrícula, financeiro familiar, mensalidades, pagamentos, gateway, conciliação, cobrança, marketing automatizado e qualquer decisão de admissão realizada por IA. O aceite não converterá o prospect em criança nem em matrícula ativa.

## 2. Evidências de pré-requisitos

O pacote fornecido foi validado anteriormente com o SHA-256 declarado pelo usuário, `7d31bc65e92c8583983172d55426ea9ab71f78776f6ce94a4624a7e925709c34`. Os nove documentos Markdown foram extraídos de forma não executável e lidos integralmente na ordem definida pelo `LEIA PRIMEIRO`; o registro detalhado está em [`package-review.md`](../../../../research_zelare/onda3_journey_20260822/package-review.md).

A PR #20 foi mergeada no SHA `196e7f2deb37b030051b3088b0c4452fe7eec17f`, e esse SHA é ancestral de `origin/main`. A árvore de trabalho estava limpa antes da criação desta branch. O banco PostgreSQL usado para replay local descartável aceitou conexão e as contagens agregadas, sem exposição de PII, eram zero para `Mantenedora`, `Unit`, `Classroom`, `Child`, `Enrollment`, `ChildGuardian` e `User`. Consequentemente, não existe massa local de dados reais ou sintéticos que possa mascarar um teste de isolamento.

A baseline pós-merge foi executada antes desta implementação. Os marcadores finais em [`baseline-gates.log`](../../../../research_zelare/onda3_journey_20260822/baseline/baseline-gates.log) registram instalação congelada, typechecks, testes e builds da API, web e site; o wrapper de shell teve uma falha de captura de `PIPESTATUS`, documentada em [`baseline-status.txt`](../../../../research_zelare/onda3_journey_20260822/baseline/baseline-status.txt), sem alterar os comandos individuais já concluídos.

## 3. Inventário de domínios que serão reutilizados

| Necessidade Journey       | Domínio existente reutilizado                          | Regra de não duplicação                                                                                           |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Organização/rede          | `Mantenedora`                                          | Todo prospect, evento, visita, política e oferta terá `mantenedoraId`.                                            |
| Unidade                   | `Unit`                                                 | A unidade pretendida será uma referência real; não haverá tabela paralela de unidades.                            |
| Programa/turma/capacidade | `Classroom`, `Unit.capacity` e `Enrollment` ativo      | A disponibilidade será calculada a partir de capacidade real menos matrículas ativas e reservas Journey vigentes. |
| Criança já matriculada    | `Child`/`Enrollment`                                   | Não será usado para prospect; a captação manterá identidade prospectiva separada.                                 |
| Responsável canônico      | `User`/`ChildGuardian`                                 | Não será criado `User` familiar nem vínculo canônico durante esta fatia.                                          |
| Comunicação existente     | `FamilyCommunication`                                  | Não será reutilizada para CRM prospectivo porque pressupõe criança existente.                                     |
| Auditoria                 | `AuditLog` e `AuditService`                            | Merge, desfazer, override, oferta e aceite serão auditáveis.                                                      |
| Outbox/idempotência       | `DomainOutboxEvent`                                    | Será reutilizado; nenhum segundo barramento ou outbox será criado.                                                |
| Escopo/RBAC               | `JwtPayload`, `Onda2AccessService`, `UnitScopeContext` | A API fará a verificação server-side por tenant e unidade; o frontend nunca será a única barreira.                |
| Navegação/flag            | `TenantFeatureFlag` e `navigationManifest`             | A flag `journey_admissions_v1` nascerá desligada e bloqueará API e menu.                                          |

O schema canônico confirma que `DomainOutboxEvent` possui `idempotencyKey` único, estado, tentativas e payload, apto para efeitos de domínio Journey [`schema.prisma`](../../apps/api/prisma/schema.prisma#L4061-L4084). A capability de acesso existente já diferencia níveis de rede, unidade e tipos operacionais, e fornece `assertUnitAccess` para isolamento server-side [`onda2-access.service.ts`](../../apps/api/src/onda2/onda2-access.service.ts).

## 4. Arquitetura aditiva proposta

A identidade prospectiva será representada por `JourneyProspect`, com campos permitidos para nome declarado do responsável, nome declarado da criança prospectiva, e-mail, telefone, identificador declarado opcional, origem, unidade pretendida, faixa etária, período, data desejada e consentimentos de captação. Dados clínicos, psicológicos, pedagógicos, comportamentais, de deficiência, saúde, alimentação, inadimplência, RDIC/RDX ou inferências não possuirão coluna, JSON, evento, métrica ou payload Journey.

A evolução do funil será registrada em `JourneyProspectStageEvent`, append-only, com versão e ator. Interações e tarefas serão persistidas em entidades Journey próprias e sempre produzirão histórico. A deduplicação será por organização e hashes normalizados de e-mail, telefone e identidade declarada; a decisão de merge será humana, versionada e reversível. O desfazer restaurará o estado e os aliases anteriores, sem apagar histórico.

Visitas terão entidade própria e eventos append-only para criação, reagendamento, cancelamento, confirmação, ausência e follow-up. A lista de espera usará `JourneyWaitlistPolicyVersion` publicado com vigência não sobreposta, `JourneyWaitlistEntry` e explicação declarativa de critérios não discriminatórios. O cálculo não fará inferência nem decisão automática; qualquer override exigirá papel autorizado, justificativa e registro de auditoria.

Ofertas vincularão prospect, unidade e turma real. A reserva temporária será protegida dentro de transação com locking/constraint de banco, contará somente reservas não expiradas e nunca excederá `capacity - activeEnrollmentCount`. A expiração será rejeitada no aceite. O aceite idempotente criará exatamente um `JourneyEnrollmentDraft` incompleto associado à oferta aceita e publicará um único evento outbox por chave idempotente.

## 5. RBAC, isolamento e feature flag

A leitura e a escrita Journey ficarão disponíveis somente para `DEVELOPER`, `MANTENEDORA`, `STAFF_CENTRAL` e, na unidade, `UNIDADE_DIRETOR`, `UNIDADE_COORDENADOR_PEDAGOGICO` e `UNIDADE_ADMINISTRATIVO`. Psicologia, nutrição, professores e famílias não terão CRM Journey nesta fatia, mesmo quando compartilham nível amplo de unidade ou staff. A API rejeitará tenant diferente e unidade fora de `unitScopes`; usuários de rede poderão consultar somente unidades da própria `mantenedoraId`.

A flag persistida será `journey_admissions_v1`, com default `enabled=false`. O servidor verificará a flag antes de cada endpoint, e o manifesto de navegação só exibirá o grupo **Jornada e Admissões** quando a flag e o papel forem compatíveis. Nenhum seed, migration ou teste ativará a flag em produção. Testes locais poderão habilitar explicitamente uma linha de tenant descartável ou usar uma dependência de teste documentada, sem alterar defaults.

A governança seguirá `diagnosticInference: false` e `humanReviewRequired: true`. O score da lista, quando exibido, será composto apenas de critérios declarativos permitidos e acompanhado de explicação, versão da política, período de cálculo, origem e horário de atualização; erro de consulta será exposto, nunca convertido em zero silencioso.

## 6. Migrations, integridade e idempotência

A migration será forward-only e aditiva: novos enums, tabelas, índices, constraints e relações; não haverá `DROP`, alteração de tabelas históricas ou reescrita de dados. Ela será criada e aplicada apenas no banco descartável/local e no CI. Nenhum comando `migrate deploy` será executado contra produção nesta tarefa.

Chaves de idempotência serão escopadas por `mantenedoraId` e operação/origem quando necessário. Comandos repetidos retornarão o mesmo agregado após re-leitura. Criação de visita, mudanças de estágio, merge/desfazer, oferta, expiração e aceite serão transacionais. Erros de conflito de unicidade serão convertidos em respostas de domínio determinísticas, e uma falha intermediária não deixará evento de sucesso sem o agregado persistido.

## 7. Plano de testes e evidências

| Risco                            | Evidência obrigatória                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicação ou merge incorreto    | Testes de e-mail/telefone/identidade por tenant, revisão humana, merge auditável e undo sem apagar eventos.                            |
| Vazamento entre tenants/unidades | Testes de API com usuários de rede, unidade, professor, família, psicologia e nutrição, incluindo URL direta e referência estrangeira. |
| Agenda inconsistente             | Testes de reagendamento, cancelamento, presença, ausência, follow-up e histórico append-only.                                          |
| Política inválida ou opaca       | Testes de vigência, versão, intervalos inválidos, explicação, ausência de campos sensíveis e override justificado.                     |
| Superlotação                     | Teste concorrente em PostgreSQL descartável com duas ofertas para a última vaga, verificando no máximo uma reserva aceita.             |
| Oferta inválida                  | Testes de expiração, recusa, aceite após cancelamento e capacidade alterada.                                                           |
| Aceite duplicado                 | Concorrência e repetição da mesma chave, verificando um único `JourneyEnrollmentDraft` e um único outbox.                              |
| Falha de UI                      | Testes de loading, erro real da API, vazio, refresh, teclado e viewport desktop/mobile.                                                |
| Privacidade                      | Scanner de conteúdo e testes de schema/DTO que rejeitam ou não contêm campos clínicos, pedagógicos ou financeiros.                     |

A validação final repetirá todos os gates existentes no novo HEAD, mais typecheck/testes API e web, migration/drift no PostgreSQL descartável, contratos/OpenAPI, build de API/web/site, scanner de privacidade, PWA, containers quando disponível e E2E autenticado por perfis sintéticos locais. Screenshots serão produzidos somente depois de a aplicação estar ligada a API e banco locais, com estado real de teste; imagens estáticas ou mocks não contarão como evidência.

## 8. Rollback e canary

O canary será manter a flag desligada em todos os tenants e validar a API apenas no banco descartável/CI. O kill switch é a própria `TenantFeatureFlag`: qualquer incidente será contido deixando-a `false` sem apagar dados. O rollback de código será revert da PR; o rollback de banco, se necessário, seguirá procedimento operacional documentado para as tabelas exclusivamente novas, depois de confirmar ausência de dependências, sem editar migrations históricas. Não haverá deploy, merge, migration em produção nem ativação de flag nesta etapa.

## 9. Conflitos de escopo analisados

Não foi encontrado modelo Journey existente no schema ou no código pesquisado. O pacote macro menciona Family Finance e evolução para matrícula digital, mas a ordem pontual recebida restringe esta PR ao Journey acima; portanto Family Finance, documentos, consentimentos e conversão canônica ficam deliberadamente adiados. Não será feita alteração no repositório `vml-arquivos/conexa-v3.0`/Conexa-COCRIS.

## Referências

[1]: ../../../../research_zelare/onda3_journey_20260822/package-review.md "Revisão do pacote Onda 3"
[2]: ../../apps/api/prisma/schema.prisma "Schema Prisma canônico"
[3]: ../../apps/api/src/onda2/onda2-access.service.ts "Acesso e escopo server-side da Onda 2"
[4]: ../../apps/api/src/common/services/audit.service.ts "Serviço de auditoria"
[5]: ../../apps/web/src/components/layout/navigationManifest.tsx "Manifesto de navegação"
