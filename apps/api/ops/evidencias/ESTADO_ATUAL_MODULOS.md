# ESTADO ATUAL DOS MÓDULOS — ZELARE V2

**Data:** 2026-02-19  
**Projeto:** Zelare-V2 (Backend + Frontend)  
**Objetivo:** Mapear estado de implementação de cada módulo do sistema

---

## RESUMO EXECUTIVO

### Repositórios Clonados
- ✅ Backend (NestJS + Prisma): `/home/ubuntu/Zelare-V2`
- ✅ Frontend (Vite + React): `/home/ubuntu/zelare-web`
- ✅ Site: `/home/ubuntu/site-zelare`

### Commits Recentes (Backend)
```
a14503e - feat(seed): seed completo CEPI Arara-Canindé 2026 — registros sintéticos, 9 professoras, 169 alunos
52be1d9 - fix(ia-assistiva): migrar para Gemini como provedor padrão de IA
65b67df - fix(ia-assistiva): inicialização lazy do OpenAI
6365fc7 - fix(migration): adiciona migration faltante para PedidoCompra
4db9a2d - feat(backend): Módulo IA Assistiva + Planejamentos com IA (PR-014 Etapa 5)
452197a - feat(backend): politica-unica-acesso + modulo pedido-compra completo (PR-014 Etapas 2-3)
447fe43 - feat(PR-006): dashboard professor, requisicoes materiais, schema v1.3, /auth/me
```

### Commits Recentes (Frontend)
```
bbcdf0e - fix(reports): seletor de turmas via lookup, labels PT-BR, correção crash Não Planejado
2735799 - fix(reports): corrigir crash Não Planejado, labels PT-BR e validação prematura
2d1cd7e - feat(frontend): utilitário exportarCSV para dashboards (PR-014 Etapa 6)
af6f278 - feat(frontend): Planejamentos Premium + IA Assistiva alinhada à Sequência Piloto 2026
bd08ac6 - feat(frontend): UX por perfil + pedidos-compra + sidebar atualizado (PR-014 Etapa 4)
```

---

## MAPEAMENTO DE MÓDULOS

| Módulo | Backend | Frontend | Status | Observações |
|--------|---------|----------|--------|-------------|
| **Autenticação/RBAC** | ✅ Completo | ✅ Completo | **EXISTE** | `/auth`, guards, JWT, refresh tokens, /auth/me |
| **Lookup/Selects** | ✅ Completo | ✅ Completo | **EXISTE** | `/lookup` - units/accessible, classrooms/accessible |
| **Diário/Microgestos** | ✅ Completo | ⚠️ Parcial | **PARCIAL** | Backend: `/diary-event` completo. Frontend: DiaryPage.tsx existe mas precisa validar "1 toque" |
| **Planejamentos** | ✅ Completo | ✅ Completo | **EXISTE** | `/planning`, `/planning-template`, integrado com IA Assistiva |
| **Matriz Curricular** | ✅ Completo | ✅ Completo | **EXISTE** | `/curriculum-matrix`, `/curriculum-matrix-entry`, import de PDF |
| **Requisição de Materiais** | ✅ Completo | ✅ Completo | **EXISTE** | `/material-request`, workflow professor → coord/direção |
| **Pedido de Compra** | ✅ Completo | ✅ Completo | **EXISTE** | `/pedido-compra`, consolidação mensal por unidade |
| **Relatórios/Dashboards** | ✅ Completo | ✅ Completo | **EXISTE** | `/reports/dashboard/*`, por perfil (professor/unidade/central) |
| **IA Assistiva** | ✅ Completo | ✅ Completo | **EXISTE** | `/ia-assistiva`, Gemini como provedor padrão |
| **Upload/Anexos** | ❌ Não existe | ❌ Não existe | **NÃO EXISTE** | Precisa criar model Arquivo + endpoints + componente frontend |
| **Frequência/Faltas** | ⚠️ Parcial | ❌ Não existe | **PARCIAL** | Model Attendance existe, mas sem controller/service/UI |
| **Atendimento aos Pais** | ❌ Não existe | ❌ Não existe | **NÃO EXISTE** | Precisa criar model + endpoints + UI |
| **Relatório de Fotos/Evidências** | ❌ Não existe | ❌ Não existe | **NÃO EXISTE** | Depende de Upload/Anexos |
| **Coordenações (Unidade/Rede)** | ❌ Não existe | ❌ Não existe | **NÃO EXISTE** | Precisa criar model + endpoints + UI |
| **RDIX/RDIC** | ❌ Não existe | ❌ Não existe | **NÃO EXISTE** | Model ReportBase existe, mas sem implementação completa |
| **Alertas Operacionais (IA)** | ❌ Não existe | ❌ Não existe | **NÃO EXISTE** | Precisa criar jobs + model AlertaOperacional |
| **Offline-first (PWA)** | ❌ Não existe | ❌ Não existe | **NÃO EXISTE** | Arquitetura futura, precisa planejar |

---

## MODELS PRISMA EXISTENTES (29 models)

```
✅ Mantenedora
✅ Unit
✅ User
✅ Role
✅ UserRole
✅ UserRoleUnitScope
✅ Permission
✅ RolePermission
✅ Child
✅ Enrollment
✅ Classroom
✅ ClassroomTeacher
✅ CurriculumMatrix
✅ CurriculumMatrixEntry
✅ PlanningTemplate
✅ Planning
✅ DiaryEvent
✅ Attendance (existe mas sem implementação completa)
✅ DietaryRestriction
✅ MaterialRequest
✅ StockItem
✅ AuditLog
✅ ReportBase (existe mas sem implementação completa)
✅ AIContext
✅ DailyMetric
✅ PedidoCompra
✅ ItemPedidoCompra
✅ SolicitacaoCorrecao
```

**Models faltantes (precisam ser criados):**
- ❌ Arquivo (upload/anexos)
- ❌ AtendimentoPais
- ❌ Coordenacao (unidade/rede)
- ❌ AlertaOperacional
- ❌ Notificacao
- ❌ SyncMutation (offline-first)

---

## CONTROLLERS BACKEND EXISTENTES

```
✅ admin.controller.ts
✅ auth.controller.ts
✅ curriculum-import.controller.ts
✅ curriculum-matrix-entry.controller.ts
✅ curriculum-matrix.controller.ts
✅ diary-event.controller.ts
✅ health.controller.ts
✅ ia-assistiva.controller.ts
✅ lookup.controller.ts
✅ material-request.controller.ts
✅ pedido-compra.controller.ts
✅ planning-template.controller.ts
✅ planning.controller.ts
✅ reports/dashboards.controller.ts
✅ reports/reports.controller.ts
```

**Controllers faltantes:**
- ❌ arquivos.controller.ts (upload/download)
- ❌ frequencia.controller.ts (attendance)
- ❌ atendimento-pais.controller.ts
- ❌ coordenacoes.controller.ts
- ❌ rdix-rdic.controller.ts
- ❌ alertas.controller.ts
- ❌ sync.controller.ts (offline)

---

## PÁGINAS FRONTEND EXISTENTES

```
✅ DashboardCentralPage.tsx
✅ DashboardPage.tsx (genérico)
✅ DashboardUnidadePage.tsx
✅ DiaryPage.tsx
✅ LoginPage.tsx
✅ MaterialRequestPage.tsx
✅ MatricesPage.tsx
✅ PedidosCompraPage.tsx
✅ PlanningsPage.tsx
✅ ReportsPage.tsx
✅ TeacherDashboardPage.tsx
```

**Páginas faltantes:**
- ❌ FrequenciaPage.tsx
- ❌ AtendimentoPaisPage.tsx
- ❌ CoordenacoesPage.tsx
- ❌ RDIXRDICPage.tsx
- ❌ AlertasPage.tsx
- ❌ FotosEvidenciasPage.tsx

---

## ANÁLISE DE GAPS (O QUE FALTA)

### 🔴 CRÍTICO (Bloqueante para MVP)
1. **Upload/Anexos** - Sem isso, não há como anexar fotos/documentos
2. **Frequência/Faltas** - Model existe mas sem UI/endpoints
3. **Diário "1 toque"** - Precisa validar se está implementado no frontend

### 🟡 IMPORTANTE (Funcionalidades core)
4. **Atendimento aos Pais** - Módulo completo faltando
5. **Coordenações** - Módulo completo faltando
6. **RDIX/RDIC** - Geração de relatórios oficiais
7. **Alertas Operacionais** - IA varredura

### 🟢 FUTURO (Pode ser fase 2)
8. **Offline-first (PWA)** - Arquitetura complexa
9. **Relatório de Fotos** - Depende de Upload

---

## DESCOBERTAS IMPORTANTES

### ✅ O que já está implementado e funcionando:
1. **RBAC completo** - Guards, decorators, scopes, unitScopes para STAFF_CENTRAL
2. **Lookup endpoints** - `/lookup/units/accessible`, `/lookup/classrooms/accessible?unitId=`
3. **Dashboards por perfil** - Professor, Unidade, Central com filtros
4. **Planejamentos com IA** - Integração com Gemini, templates por faixa etária
5. **Requisição de Materiais** - Workflow completo professor → aprovação
6. **Pedido de Compra** - Consolidação mensal por unidade
7. **Seed 2026** - CEPI Arara-Canindé com registros sintéticos, 9 professoras, 169 alunos
8. **Auditoria** - AuditLog automático em todas operações

### ⚠️ O que está parcialmente implementado:
1. **DiaryEvent** - Backend completo, frontend existe mas precisa validar "1 toque"
2. **Attendance** - Model existe, mas sem controller/service/UI
3. **ReportBase** - Model existe, mas sem implementação de RDIX/RDIC

### ❌ O que NÃO existe:
1. **Upload/Anexos** - Crítico, bloqueia fotos/evidências
2. **Atendimento aos Pais** - Módulo completo faltando
3. **Coordenações** - Módulo completo faltando
4. **RDIX/RDIC** - Geração assistida + edição
5. **Alertas Operacionais** - Jobs de varredura
6. **Offline-first** - PWA + sync

---

## PRÓXIMOS PASSOS (FASE 2: VALIDAÇÃO DE PRODUÇÃO)

1. ✅ Mapear módulos existentes (CONCLUÍDO)
2. ⏭️ Validar produção via smoke tests na API
3. ⏭️ Executar PRs sequenciais conforme packet de execução

---

**Fim do Mapeamento de Módulos**
