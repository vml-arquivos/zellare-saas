# Gate 0.2 — PII e artifacts de build

## Objetivo

O Zelare possui arquivos de desenvolvimento usados para popular ambientes de demonstração. Alguns carregam nomes, contatos, turmas, funcionários ou planilhas de cadastro. Esses arquivos não devem ser enviados para a imagem da API nem tratados como fonte de dados de produção. O Gate 0.2 protege o contexto de build sem apagar dados do repositório e sem alterar o banco do Zelare ou qualquer artefato do Conexa/COCRIS.

## Política de retenção

A proteção implementada nesta etapa é **preventiva e reversível**. O `apps/api/.dockerignore` impede que cargas pessoais, imports locais, documentação operacional e seeds reais sejam incluídos na imagem Docker da API. O script `apps/api/scripts/check-sensitive-artifacts.mjs` verifica os caminhos versionados por nome e aplica uma allowlist explícita aos catálogos públicos.

> **P0-2 — decisão humana obrigatória:** remover arquivos do histórico Git, limpar objetos antigos, reescrever commits ou executar qualquer operação destrutiva não faz parte deste Gate. Essas ações somente poderão ocorrer após aprovação humana explícita e um plano separado de backup, retenção e restauração.

## Allowlist pública mantida

Os seguintes arquivos são considerados catálogos ou amostras públicas e continuam disponíveis para o build e para seeds determinísticos:

| Caminho | Uso permitido |
| --- | --- |
| `apps/api/data/catalogo_administrativo.csv` | Catálogo público administrativo |
| `apps/api/data/catalogo_alimentos.csv` | Catálogo público de alimentos |
| `apps/api/data/catalogo_higiene_pessoal.csv` | Catálogo público de higiene pessoal |
| `apps/api/data/catalogo_materiais_higiene_pedagogico.csv` | Catálogo público de materiais |
| `apps/api/data/catalogo_pedagogico.csv` | Catálogo público pedagógico |
| `apps/api/data/matriz-curricular-2026-sample.json` | Amostra curricular sem cadastro pessoal |
| `apps/api/datasets/materiais_seed.json` | Materiais de seed sem cadastro pessoal |

## Caminhos bloqueados no build

Planilhas (`*.xlsx` e `*.xls`), o diretório `apps/api/imports/`, `apps/api/docs/`, `apps/api/ops/`, datasets nomeados como alunos ou turmas, o cadastro de funcionários e seeds reais não entram na imagem. A exclusão é feita no contexto de build; os arquivos ainda podem existir no clone local até que uma decisão humana determine uma política de remoção histórica.

O `Dockerfile` continua copiando migrations e catálogos públicos necessários ao runtime. Seeds de desenvolvimento, imports e documentação não são necessários para a execução da API ou para o job explícito de migrations e, por isso, ficam fora da imagem.

## Execução local e CI

O gate pode ser executado a partir da raiz com:

```bash
pnpm --filter @zelare/api security:artifacts
```

Ele falha quando encontra um caminho sensível versionado, um arquivo em `data/` ou `datasets/` fora da allowlist, ou uma regra mínima ausente em `apps/api/.dockerignore`. O gate não inspeciona nem modifica dados de banco, não faz upload de arquivos e não reescreve o histórico Git.

## Evidência deste Gate

A evidência deve registrar o commit, o resultado do scanner e o `git status --short` após a execução. A presença de arquivos históricos sensíveis no repositório é um risco residual conhecido; a mitigação desta fase é impedir seu empacotamento em imagens novas e impedir a entrada de novos caminhos sem revisão.
