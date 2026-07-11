_Gerado por MANUZ, Engenheiro de Software Sênior._

# Guia de Uso: Módulo de Planejamento Pedagógico

**Data:** 03 de Fevereiro de 2026

Este documento detalha como utilizar a API do Módulo de Planejamento Pedagógico do Zelare, incluindo endpoints, regras de acesso e exemplos práticos.

---

## 1. Visão Geral

O Módulo de Planejamento Pedagógico é responsável por estruturar o planejamento anual, mensal e semanal das turmas. Ele é dividido em duas partes:

-   **Planning Templates**: Modelos reutilizáveis criados pela Mantenedora ou Coordenação Geral.
-   **Plannings**: Instâncias de planejamento aplicadas a uma turma em um período específico.

Este módulo fecha o ciclo **Planejamento → Execução → Registro**, servindo de base para o Diário de Bordo e relatórios futuros.

---

## 2. API de Planning Templates

**URL Base:** `/planning-templates`

### 2.1. Criar Template

**Endpoint:** `POST /planning-templates`

Cria um novo template de planejamento. Apenas Mantenedora e Staff Central podem criar.

**Body:** `CreatePlanningTemplateDto`

```json
{
  "name": "Planejamento Semanal - Berçário II",
  "description": "Modelo de planejamento semanal para turmas de Berçário II, com foco em desenvolvimento motor e sensorial.",
  "type": "SEMANAL",
  "sections": {
    "campos_experiencia": true,
    "objetivos_aprendizagem": true,
    "atividades_propostas": true
  },
  "fields": {
    "recursos_necessarios": "text",
    "observacoes_gerais": "textarea"
  }
}
```

### 2.2. Listar Templates

**Endpoint:** `GET /planning-templates`

Lista templates com base no escopo do usuário e filtros opcionais.

**Query Params:**

-   `mantenedoraId` (string): Filtrar por mantenedora.
-   `type` (PlanningType): Filtrar por tipo (ANUAL, MENSAL, SEMANAL).
-   `search` (string): Buscar por nome ou descrição.

### 2.3. Outras Rotas

-   `GET /planning-templates/:id`: Buscar template por ID.
-   `PUT /planning-templates/:id`: Atualizar template.
-   `DELETE /planning-templates/:id`: Deletar template (soft delete).

---

## 3. API de Plannings

**URL Base:** `/plannings`

### 3.1. Criar Planejamento

**Endpoint:** `POST /plannings`

Cria uma instância de planejamento para uma turma. Professores NÃO podem criar planejamentos.

**Body:** `CreatePlanningDto`

```json
{
  "templateId": "clx_template_1",
  "classroomId": "clx_classroom_1",
  "startDate": "2026-02-09T00:00:00.000Z",
  "endDate": "2026-02-13T23:59:59.999Z",
  "objectives": {
    "sensorial": "Explorar diferentes texturas com as mãos e os pés.",
    "motor": "Estimular o movimento de pinça com objetos seguros."
  },
  "activities": {
    "segunda": "Caixa de areia com objetos de diferentes texturas.",
    "terca": "Pintura com os dedos usando tintas comestíveis."
  }
}
```

### 3.2. Listar Planejamentos

**Endpoint:** `GET /plannings`

Lista planejamentos com base no escopo do usuário e filtros opcionais.

**Query Params:**

-   `classroomId` (string): Filtrar por turma.
-   `unitId` (string): Filtrar por unidade.
-   `templateId` (string): Filtrar por template.
-   `status` (PlanningStatus): Filtrar por status (DRAFT, ACTIVE, CLOSED).
-   `type` (PlanningType): Filtrar por tipo (ANUAL, MENSAL, SEMANAL).
-   `startDate` (string): Data inicial.
-   `endDate` (string): Data final.

### 3.3. Mudar Status

**Endpoint:** `PATCH /plannings/:id/status`

Altera o status de um planejamento. Professores NÃO podem ativar ou fechar planejamentos.

**Body:** `ChangeStatusDto`

```json
{
  "status": "ACTIVE"
}
```

### 3.4. Outras Rotas

-   `GET /plannings/:id`: Buscar planejamento por ID.
-   `PUT /plannings/:id`: Atualizar planejamento.

---

## 4. Regras de Acesso

| Papel | Acesso a Templates | Acesso a Planejamentos |
| :--- | :--- | :--- |
| **Professor** | Visualizar | Visualizar (suas turmas), Editar DRAFT (suas turmas) |
| **Coordenação/Direção** | Visualizar | Criar, Editar, Ativar (sua unidade) |
| **Staff Central** | Criar, Editar (seus), Deletar (seus) | Visualizar (unidades vinculadas) |
| **Mantenedora** | Acesso total | Acesso total |
| **Desenvolvedor** | Acesso total | Acesso total |

---

## 5. Integração com Diário de Bordo

Ao criar um `DiaryEvent`, inclua o `planningId` para vincular o evento ao planejamento ativo:

```json
{
  "type": "DESENVOLVIMENTO_COGNITIVO",
  "title": "Atividade de texturas",
  "description": "Explorou a caixa de areia com interesse.",
  "eventDate": "2026-02-09T10:00:00.000Z",
  "childId": "clx_child_1",
  "classroomId": "clx_classroom_1",
  "planningId": "clx_planning_1" // Vínculo com o planejamento
}
```

---

**O Módulo de Planejamento Pedagógico está pronto para uso!** 📅✨
