# Variáveis de ambiente do site Zelare

O site público separa suas variáveis de runtime das variáveis da API. Segredos nunca devem ser versionados. Em produção, o build falha se os canais institucionais obrigatórios não estiverem configurados e válidos.

## Banco e aplicação

```text
SITE_DATABASE_URL=<SITE_DATABASE_URL_FROM_COOLIFY>
DATABASE_URL=<SITE_DATABASE_URL_FROM_COOLIFY>
JWT_SECRET=<SECRET_FROM_SECRET_MANAGER>
NODE_ENV=production
PORT=3001
VITE_SITE_URL=https://zelare.casadf.com.br
```

`SITE_DATABASE_URL` é a conexão usada pelo site para unidades, blog, projetos, transparência, candidaturas e contatos. O site não cria unidades locais quando o banco está ausente ou indisponível.

## Canais institucionais públicos

Estas variáveis são incorporadas ao bundle público. Use os canais institucionais aprovados pela mantenedora:

```text
VITE_PUBLIC_CONTACT_EMAIL=contato@zelare.com.br
VITE_PUBLIC_COMPLIANCE_EMAIL=denuncia@zelare.com.br
VITE_PUBLIC_PHONE=(61) 2123-4567
VITE_PUBLIC_ADDRESS=Brasília-DF
```

As quatro variáveis são obrigatórias para `NODE_ENV=production`. O build rejeita e-mail inválido, domínio `example.invalid`, telefone vazio/zerado e endereço genérico. Em desenvolvimento e testes, os valores públicos históricos do Zelare são usados somente como defaults locais; eles não substituem a configuração do ambiente de produção.

## Stripe e e-mail transacional

Configure segredos do provedor diretamente no Coolify:

```text
STRIPE_SECRET_KEY=<SECRET_FROM_SECRET_MANAGER>
VITE_STRIPE_PUBLISHABLE_KEY=<PUBLIC_KEY_FROM_PROVIDER>
STRIPE_WEBHOOK_SECRET=<SECRET_FROM_SECRET_MANAGER>
SMTP_HOST=<SMTP_HOST_FROM_SECRET_MANAGER>
SMTP_PORT=587
SMTP_USER=<SMTP_USER_FROM_SECRET_MANAGER>
SMTP_PASSWORD=<SECRET_FROM_SECRET_MANAGER>
SMTP_FROM=contato@zelare.com.br
```

Não coloque chaves, senhas, tokens, números de cartão ou credenciais de teste no repositório. Use apenas o ambiente de teste do provedor para testes de pagamento.

## Analytics opcional

```text
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

Quando o endpoint estiver vazio, nenhum script de analytics é carregado.

## Deploy no Coolify

No recurso do site, use `/apps/site` como diretório-base, a porta `3001` e o domínio `https://zelare.casadf.com.br`. O build deve executar a instalação congelada e o build do pacote; o start deve usar o bundle do site em modo de produção.

Migrations do banco do site não são executadas no startup. Se houver alteração de schema, gere e aplique a migration como job explícito, revisado e registrado. Nunca rode seed, importação de planilhas ou correção de dados pessoais durante o deploy.

## Comportamento de unidades

A rota pública de unidades consulta somente unidades ativas no banco do site. Em caso de erro, a página mostra indisponibilidade real e um botão de nova tentativa. Em caso de lista vazia, mostra que não há unidades cadastradas. Nenhuma unidade fictícia é criada ou renderizada no bundle.

## Validação pós-publicação

Verifique, no ambiente autorizado, o carregamento de `/`, `/unidades`, `/compliance` e `/contato`. Confirme os links `mailto:` e `tel:` dos canais públicos, a ausência de `example.invalid` no HTML/bundle e o estado de nova tentativa quando a consulta de unidades falhar.
