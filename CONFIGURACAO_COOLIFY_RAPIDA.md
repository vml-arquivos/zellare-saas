# Configuração rápida do Zelare no Coolify

Este runbook descreve a configuração dos três serviços do Zelare no ambiente autorizado. **Segredos e credenciais devem ser inseridos somente no gerenciador de variáveis do Coolify**; não devem ser copiados para este repositório.

## Serviços

| Serviço | Domínio | Diretório | Porta | Build |
|---|---|---|---:|---|
| API | `https://apizelare.casadf.com.br` | `/apps/api` | 3000 | Dockerfile `/Dockerfile` |
| Aplicação web | `https://appzelare.casadf.com.br` | `/apps/web` | 5173 | Nixpacks |
| Site público | `https://zelare.casadf.com.br` | `/apps/site` | 3001 | Dockerfile ou Nixpacks conforme o recurso existente |

## API

Configure no Coolify as variáveis obrigatórias usando valores do ambiente autorizado:

```text
DATABASE_URL=<DATABASE_URL_FROM_COOLIFY>
DIRECT_URL=<DIRECT_URL_FROM_COOLIFY>
REDIS_URL=<REDIS_URL_FROM_COOLIFY>
JWT_SECRET=<SECRET_FROM_SECRET_MANAGER>
JWT_EXPIRATION=7d
NODE_ENV=production
PORT=3000
APP_TIMEZONE=America/Sao_Paulo
API_URL=https://apizelare.casadf.com.br
CORS_ORIGIN=https://appzelare.casadf.com.br,https://zelare.casadf.com.br
GEMINI_API_KEY=<SECRET_FROM_SECRET_MANAGER>
GEMINI_MODEL=gemini-3.6-flash
ENABLE_AI_ASSISTANT=true
ENABLE_OFFLINE_MODE=true
```

O entrypoint da API é deliberadamente seguro: não executa migration, seed, import, backfill ou correção de dados no startup. Qualquer migration deve ser executada como job explícito, revisado e registrado antes de uma publicação autorizada.

## Aplicação web

```text
VITE_API_URL=https://apizelare.casadf.com.br
VITE_APP_NAME=Zelare
VITE_APP_VERSION=3.0.0
```

## Site público

O site usa o PostgreSQL próprio do site por meio de `SITE_DATABASE_URL`. As unidades exibidas publicamente vêm exclusivamente das linhas ativas desse banco; se a consulta falhar, a interface informa indisponibilidade e oferece nova tentativa. **Nenhuma unidade demonstrativa é usada em produção.**

```text
SITE_DATABASE_URL=<SITE_DATABASE_URL_FROM_COOLIFY>
DATABASE_URL=<SITE_DATABASE_URL_FROM_COOLIFY>
NODE_ENV=production
PORT=3001
VITE_SITE_URL=https://zelare.casadf.com.br
VITE_PUBLIC_CONTACT_EMAIL=contato@zelare.com.br
VITE_PUBLIC_COMPLIANCE_EMAIL=denuncia@zelare.com.br
VITE_PUBLIC_PHONE=(61) 2123-4567
VITE_PUBLIC_ADDRESS=Brasília-DF
```

Os quatro canais públicos acima são obrigatórios no build de produção e devem ser confirmados pelo responsável institucional antes da publicação. Se qualquer um estiver ausente ou inválido, o build deve falhar; não substitua a configuração por e-mail, telefone ou endereço fictício.

Para notificações por e-mail, configure os valores no Coolify sem armazená-los no Git:

```text
SMTP_HOST=<SMTP_HOST_FROM_SECRET_MANAGER>
SMTP_PORT=587
SMTP_USER=<SMTP_USER_FROM_SECRET_MANAGER>
SMTP_PASSWORD=<SECRET_FROM_SECRET_MANAGER>
SMTP_FROM=contato@zelare.com.br
```

## Ordem segura

1. Validar variáveis e domínios no Coolify.
2. Aplicar migrations somente em job explícito e após revisão humana.
3. Publicar a API e validar `/health`.
4. Publicar a aplicação web e validar login no ambiente autorizado.
5. Publicar o site e validar `/`, `/unidades`, `/compliance` e `/contato`.
6. Confirmar nos logs que o site não renderiza `example.invalid`, não exibe unidades fictícias e apresenta nova tentativa quando a fonte de unidades está indisponível.

Não execute scripts de seed, imports de planilhas ou comandos de criação de administrador durante o deploy. Cadastros e acessos devem ser provisionados por fluxo administrativo auditável, com credenciais fornecidas somente pelo ambiente autorizado.
