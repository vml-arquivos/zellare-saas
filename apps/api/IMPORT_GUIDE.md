## Guia de Importação da Matriz Curricular - Zelare

Este guia descreve o processo completo de importação da Matriz Curricular 2026 a partir de um arquivo PDF.

---

## 1. Pré-requisitos

Antes de iniciar a importação, certifique-se de que:

1. **Matriz Curricular criada**: Você deve ter uma `CurriculumMatrix` criada no banco. Se não tiver, crie uma usando o endpoint `POST /curriculum-matrices`.

2. **Arquivo PDF disponível**: O arquivo PDF da Matriz Curricular deve estar acessível no servidor (caminho local) ou via URL.

3. **Permissões adequadas**: Apenas usuários com nível `MANTENEDORA` ou `STAFF_CENTRAL` podem importar matrizes.

---

## 2. Fluxo de Importação

O fluxo de importação segue duas etapas:

### 2.1 Dry-run (Simulação)

A primeira etapa é sempre executar um **dry-run** para validar o PDF e visualizar o que será importado **sem gravar no banco**.

**Endpoint:** `POST /curriculum-matrices/import/dry-run`

**Request Body:**

```json
{
  "mantenedoraId": "ID_MANTENEDORA",
  "year": 2026,
  "segment": "EI02",
  "version": 1,
  "sourceUrl": "/path/to/your/pdf/file.pdf",
  "mode": "DRY_RUN"
}
```

**Response:**

```json
{
  "mode": "DRY_RUN",
  "totalExtracted": 200,
  "totalInserted": 150,
  "totalUpdated": 30,
  "totalUnchanged": 20,
  "preview": [
    {
      "action": "INSERT",
      "date": "2026-02-03",
      "entry": {
        "date": "2026-02-03T00:00:00-03:00",
        "weekOfYear": 6,
        "dayOfWeek": 1,
        "campoDeExperiencia": "O_EU_O_OUTRO_E_O_NOS",
        "objetivoBNCC": "Perceber que suas ações têm efeitos...",
        "objetivoBNCCCode": "EI02EO01",
        "objetivoCurriculo": "Experimentar situações...",
        "intencionalidade": "Promover a autonomia...",
        "exemploAtividade": "Atividade de espelho..."
      }
    }
  ],
  "errors": []
}
```

### 2.2 Apply (Importação Real)

Após validar o dry-run, execute a importação real.

**Endpoint:** `POST /curriculum-matrices/:id/import/pdf`

**Request Body:**

```json
{
  "sourceUrl": "/path/to/your/pdf/file.pdf",
  "mode": "APPLY",
  "force": false
}
```

**Parâmetros:**

- `force`: Se `true`, atualiza campos normativos (objetivos BNCC e Currículo). Se `false`, atualiza apenas campos editáveis (intencionalidade e exemplo de atividade).

**Response:**

```json
{
  "mode": "APPLY",
  "matrixId": "ID_DA_MATRIZ",
  "totalExtracted": 200,
  "totalInserted": 150,
  "totalUpdated": 30,
  "totalUnchanged": 20,
  "errors": []
}
```

---

## 3. Idempotência

A importação é **idempotente**, ou seja, executar a mesma importação múltiplas vezes **não duplica dados**.

O sistema usa o unique constraint `(matrixId, date)` para garantir que cada dia letivo tenha apenas uma entrada por matriz.

**Teste de idempotência:**

1. Execute a importação uma vez.
2. Execute a importação novamente com o mesmo PDF.
3. Verifique que `totalInserted = 0` e `totalUnchanged = totalExtracted`.

---

## 4. Formato Esperado do PDF

O parser foi desenvolvido para extrair dados de PDFs com a seguinte estrutura:

```
03/02/2026 | Semana 6 | Segunda | O eu, o outro e o nós | EI02EO01 | Objetivo BNCC... | Objetivo Currículo... | Intencionalidade... | Exemplo de Atividade...
```

**IMPORTANTE:** O parser atual é uma implementação simplificada. Para PDFs com estruturas diferentes, o `CurriculumPdfParserService` deve ser adaptado.

---

## 5. Auditoria

Todas as importações são registradas no `AuditLog` com:

- **Ação**: `IMPORT`
- **Entidade**: `CurriculumMatrix`
- **Estatísticas**: Total extraído, inserido, atualizado e não alterado
- **Fonte**: URL ou caminho do PDF

---

## 6. Troubleshooting

### Erro: "Nenhuma entrada válida foi encontrada no PDF"

**Causa:** O formato do PDF não corresponde ao esperado pelo parser.

**Solução:** Adapte o `CurriculumPdfParserService.extractEntries()` para o formato real do seu PDF.

### Erro: "Matriz curricular não encontrada"

**Causa:** O `matrixId` fornecido não existe no banco.

**Solução:** Crie a matriz primeiro usando `POST /curriculum-matrices`.

### Erro: "Você não tem permissão para importar esta matriz"

**Causa:** Seu usuário não tem o nível `MANTENEDORA` ou `STAFF_CENTRAL`.

**Solução:** Solicite permissões adequadas ao administrador do sistema.

---

## 7. Exemplo Completo

```bash
# 1. Criar a matriz
curl -X POST http://localhost:3000/curriculum-matrices \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mantenedoraId": "ID_MANTENEDORA",
    "year": 2026,
    "segment": "EI02",
    "version": 1,
    "description": "Matriz Curricular 2026 - Creche II",
    "isActive": true
  }'

# 2. Dry-run
curl -X POST http://localhost:3000/curriculum-matrices/import/dry-run \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mantenedoraId": "ID_MANTENEDORA",
    "year": 2026,
    "segment": "EI02",
    "version": 1,
    "sourceUrl": "/path/to/matriz_2026.pdf",
    "mode": "DRY_RUN"
  }'

# 3. Apply
curl -X POST http://localhost:3000/curriculum-matrices/ID_DA_MATRIZ/import/pdf \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "/path/to/matriz_2026.pdf",
    "mode": "APPLY",
    "force": false
  }'
```

---

**A importação está completa!** 🎓✨
