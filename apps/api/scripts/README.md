# Scripts da API Zelare

## Política de dados

Este diretório não distribui cadastros de pessoas, logins, senhas, planilhas, imports ou seeds de produção. Dados de desenvolvimento devem ser criados somente em banco descartável, com fixtures sintéticas e procedimento explícito.

> **Regra:** nunca coloque e-mail, senha, CPF, telefone, nome de criança, nome de funcionário, token, chave de API ou arquivo de cadastro neste repositório.

## Seed padrão

O comando abaixo é seguro por padrão e **não cria dados**:

```bash
pnpm --filter @zelare/api db:seed
```

Ele apenas informa que o seed está desabilitado. Para executar o caminho sintético explicitamente:

```bash
ALLOW_SYNTHETIC_SEED=true pnpm --filter @zelare/api seed:synthetic
```

A fixture sintética atual não insere registros: o harness do CI cria e destrói o banco descartável quando precisa validar schema, migrations e contratos. Nenhum comando de seed deve apontar para produção.

## Catálogos públicos

Os scripts de catálogo e matriz curricular podem consumir somente os arquivos públicos e não pessoais mantidos em `apps/api/data/` e `apps/api/datasets/`, conforme a allowlist do scanner. Esses arquivos não representam alunos, responsáveis, funcionários ou contas de acesso.

## Criação administrativa

A criação de uma conta administrativa é uma operação controlada e exige valores fornecidos no momento da execução ou pelo gerenciador de segredos. Não há credencial padrão no código:

```bash
ZELARE_ADMIN_EMAIL='admin@example.invalid' \
ZELARE_ADMIN_PASSWORD="$ADMIN_PASSWORD_FROM_SECRET_MANAGER" \
ZELARE_ADMIN_FIRST_NAME='Admin' \
ZELARE_ADMIN_LAST_NAME='Sistema' \
node scripts/create-admin.js
```

O valor da senha não deve ser passado em documentação, histórico do shell ou saída de logs. A conta criada deve ser de um ambiente autorizado e a senha deve ser trocada imediatamente conforme a política da instituição.

## Segurança e validação

Antes de abrir uma PR, execute:

```bash
pnpm --filter @zelare/api security:artifacts
pnpm --filter @zelare/api typecheck
pnpm --filter @zelare/api test -- --runInBand
```

O scanner verifica nomes de caminhos e conteúdo textual, incluindo credenciais literais, tokens, chaves, e-mails não sintéticos, CPF, telefone, referências a planilhas/cadastros reais e nomes de pessoas conhecidos nos artefatos de risco. O histórico Git não é reescrito pelo scanner.
