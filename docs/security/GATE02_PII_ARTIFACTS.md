# Gate 0.2 — Artefatos sensíveis e PII

## Objetivo

O Zelare não deve versionar dados de crianças, responsáveis, funcionários, contatos pessoais, credenciais, tokens, chaves, planilhas de cadastro ou exports de banco. O gate protege o clone local, o contexto de build e as imagens publicadas sem alterar bancos, sem apagar dados de produção e sem reescrever o histórico Git.

## Política de retenção

A proteção é preventiva e forward-only. O `.dockerignore` impede que imports, documentação operacional, planilhas, seeds pessoais e datasets nominados sejam enviados para a imagem da API. O `apps/api/scripts/check-sensitive-artifacts.mjs` inspeciona também o conteúdo dos arquivos versionados, não apenas seus caminhos.

O scanner bloqueia credenciais literais, tokens Bearer, chaves de API, blocos de chave privada, e-mails não sintéticos, CPF, telefone, marcadores de planilhas/cadastros reais e nomes pessoais conhecidos em artefatos de risco. Placeholders devem usar domínios reservados, como `example.invalid`, e valores devem ser fornecidos por variáveis protegidas fora do repositório.

> **P0-2 — decisão humana obrigatória:** remover objetos antigos, limpar o histórico Git, reescrever commits ou executar qualquer operação destrutiva não faz parte deste gate. Essas ações exigem aprovação explícita e plano separado de backup, retenção e restauração.

## Allowlist pública mantida

A allowlist é restrita a catálogos e fixtures sem cadastro pessoal:

| Caminho | Uso permitido |
| --- | --- |
| `apps/api/data/catalogo_administrativo.csv` | Catálogo público administrativo |
| `apps/api/data/catalogo_alimentos.csv` | Catálogo público de alimentos |
| `apps/api/data/catalogo_higiene_pessoal.csv` | Catálogo público de higiene pessoal |
| `apps/api/data/catalogo_materiais_higiene_pedagogico.csv` | Catálogo público de materiais |
| `apps/api/data/catalogo_pedagogico.csv` | Catálogo público pedagógico |
| `apps/api/data/matriz-curricular-2026-sample.json` | Amostra curricular sem cadastro pessoal |
| `apps/api/datasets/materiais_seed.json` | Materiais sintéticos de desenvolvimento |

## Seed e dados descartáveis

`db:seed` não cria dados. O caminho opcional `seed:synthetic` é reservado a banco descartável e não distribui contas, logins ou cadastros. O CI cria fixtures em memória ou no PostgreSQL efêmero quando precisa validar contratos. Nenhum seed deve receber uma URL de produção.

## Execução local e CI

Execute o gate a partir da raiz:

```bash
pnpm --filter @zelare/api security:artifacts
```

Ele falha quando encontra caminho sensível versionado, arquivo fora da allowlist de dados públicos ou conteúdo que corresponda às regras de PII/credenciais. Também valida as regras mínimas do `apps/api/.dockerignore`. O gate não inspeciona nem modifica dados de banco, não faz upload e não reescreve o histórico.

## Evidência

A evidência deve registrar o SHA do novo HEAD, a saída integral do scanner, a lista de arquivos analisados e o `git status --short` após a execução. Qualquer exceção deve ser documentada com justificativa, escopo e revisão humana; não se deve reduzir a regra para fazer o CI passar.
