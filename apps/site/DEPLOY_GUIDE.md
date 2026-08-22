# Guia de deploy — Site público Zelare

Este guia se aplica ao site público do monorepo `vml-arquivos/zellare-saas`, publicado no Coolify como `site-zellare-saas`, no domínio `https://zelare.casadf.com.br`.

## Pré-requisitos

O ambiente deve possuir Coolify autenticado, DNS apontado para a VPS, certificado HTTPS ativo e o PostgreSQL do site disponível. O site não usa cadastro local de demonstração em produção: unidades, projetos, posts, transparência, candidaturas e contatos são lidos do banco autorizado.

## Configuração do recurso

| Campo | Valor |
|---|---|
| Repositório | `vml-arquivos/zellare-saas` |
| Diretório-base | `/apps/site` |
| Porta | `3001` |
| Domínio | `https://zelare.casadf.com.br` |
| Build | `pnpm install --frozen-lockfile && pnpm build` |
| Start | `NODE_ENV=production node dist/index.js` |

Se o recurso existente usar Dockerfile, mantenha o Dockerfile e a porta já configurados no Coolify. Não altere a aplicação de API ou o banco da API ao configurar o site.

## Variáveis de ambiente

Configure no painel de Environment Variables do Coolify. Segredos devem ser obtidos do gerenciador de segredos e nunca devem ser escritos no Git.

```env
SITE_DATABASE_URL=<SITE_DATABASE_URL_FROM_COOLIFY>
DATABASE_URL=<SITE_DATABASE_URL_FROM_COOLIFY>
JWT_SECRET=<SECRET_FROM_SECRET_MANAGER>
NODE_ENV=production
PORT=3001
VITE_SITE_URL=https://zelare.casadf.com.br

# Canais institucionais públicos — obrigatórios no build de produção
VITE_PUBLIC_CONTACT_EMAIL=contato@zelare.com.br
VITE_PUBLIC_COMPLIANCE_EMAIL=denuncia@zelare.com.br
VITE_PUBLIC_PHONE=(61) 2123-4567
VITE_PUBLIC_ADDRESS=Brasília-DF

# Integrações opcionais, quando habilitadas
STRIPE_SECRET_KEY=<SECRET_FROM_SECRET_MANAGER>
VITE_STRIPE_PUBLISHABLE_KEY=<PUBLIC_KEY_FROM_PROVIDER>
STRIPE_WEBHOOK_SECRET=<SECRET_FROM_SECRET_MANAGER>
SMTP_HOST=<SMTP_HOST_FROM_SECRET_MANAGER>
SMTP_PORT=587
SMTP_USER=<SMTP_USER_FROM_SECRET_MANAGER>
SMTP_PASSWORD=<SECRET_FROM_SECRET_MANAGER>
SMTP_FROM=contato@zelare.com.br
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

Os quatro canais públicos são validados no build. O build deve falhar se faltar e-mail, telefone ou endereço, ou se algum valor for inválido. Não use contato fictício, telefone zerado, domínio inválido ou dados pessoais de teste.

## Banco de dados e unidades públicas

`SITE_DATABASE_URL` deve apontar para o PostgreSQL próprio do site. O site consulta somente unidades ativas e ordena os resultados pelo nome. Se o banco ou a consulta estiver indisponível, `/unidades` informa a indisponibilidade e oferece nova tentativa; não mostra unidades inventadas. Se não houver linhas ativas, a página informa que não há unidades cadastradas.

O startup do site não deve executar seed, importação de planilhas, backfill, correção de dados ou migration automaticamente. Alterações de schema devem ser preparadas como migration explícita, revisadas e executadas em job separado conforme o procedimento de mudança aprovado.

## Ordem de publicação

1. Validar o diff na PR e confirmar que os 14 gates do CI estão verdes no HEAD final.
2. Confirmar no Coolify todas as variáveis obrigatórias, domínios e portas.
3. Executar migration somente se houver migration aprovada para o banco do site; registrar o resultado.
4. Publicar o site pelo fluxo de branch/PR aprovado.
5. Verificar `https://zelare.casadf.com.br`, `/unidades`, `/compliance` e `/contato`.
6. Confirmar que os links de e-mail e telefone apontam para os canais institucionais configurados.
7. Confirmar que o HTML e o bundle não contêm `example.invalid`, unidades fictícias ou credenciais.

Não execute scripts de seed, imports de planilhas ou comandos de criação de administrador no container de produção. A criação de usuários deve ocorrer por fluxo administrativo auditável no ambiente autorizado.

## Validação pós-deploy

```bash
curl -fsS https://zelare.casadf.com.br/ | head
curl -fsS https://zelare.casadf.com.br/unidades | head
curl -fsS https://zelare.casadf.com.br/compliance | head
curl -fsS https://zelare.casadf.com.br/contato | head
```

Também valide visualmente o formulário de contato, o canal de denúncias, a lista de unidades e o estado de nova tentativa com a API de unidades temporariamente indisponível em ambiente de teste. Não simule indisponibilidade alterando produção.

## Stripe e e-mail

Integrações de pagamento e e-mail são opcionais. As chaves devem ser cadastradas somente no Coolify, com separação entre teste e produção. Webhooks devem usar o domínio real do site e o segredo correspondente ao ambiente. Nunca registre tokens, senhas de aplicativo, dados de cartão ou credenciais nos arquivos do projeto.

## Segurança e LGPD

Mantenha HTTPS, backups do PostgreSQL, controle de acesso ao Coolify e monitoramento de logs. Dados de crianças, famílias, profissionais e candidatos devem permanecer no banco autorizado, com acesso conforme finalidade e permissões. Não exporte dados pessoais para fixtures, planilhas versionadas, screenshots ou documentação pública.

## Atualizações e rollback

Toda alteração deve ser feita em branch própria, validada localmente e submetida por PR. Após o merge aprovado, o Coolify pode ser acionado pelo processo de publicação autorizado. Para rollback, selecione no Coolify o release anterior comprovadamente saudável; não reescreva histórico nem force-push.

## Troubleshooting

Se o build falhar, leia a primeira mensagem de configuração ausente, confirme as quatro variáveis `VITE_PUBLIC_*` e repita o build com o ambiente correto. Se as unidades não carregarem, confirme `SITE_DATABASE_URL`, conectividade do PostgreSQL e logs do serviço; a resposta correta é indisponibilidade, não criação de dados locais. Se o domínio falhar, confirme DNS, certificado, porta `3001` e roteamento do Coolify.

## Checklist

- [ ] PR validada e CI aprovado no HEAD final.
- [ ] Domínio `zelare.casadf.com.br` e HTTPS ativos.
- [ ] `SITE_DATABASE_URL` configurada no Coolify.
- [ ] Quatro canais institucionais públicos configurados e válidos.
- [ ] Nenhuma unidade fictícia no bundle ou no HTML publicado.
- [ ] Nenhuma ocorrência funcional de `example.invalid`.
- [ ] `/unidades` exibe dados reais ou indisponibilidade com nova tentativa.
- [ ] `/compliance` exibe e-mail e telefone institucionais.
- [ ] `/contato` exibe e-mail, telefone e endereço institucionais.
- [ ] Nenhum seed, import ou migration automática no startup.
- [ ] Backup e monitoramento confirmados.

**Última atualização:** agosto de 2026
