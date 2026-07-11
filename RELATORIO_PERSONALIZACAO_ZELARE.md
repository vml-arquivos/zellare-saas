# Relatório de personalização inicial — Zelare

## Status

Personalização inicial aplicada com sucesso no pacote do repositório `zellare-saas-main`.

## Alterações principais

- Nome institucional ajustado para **Zelare**.
- Slogan aplicado: **cuidado, pedagogia e gestão inteligente**.
- Logos adicionadas em `apps/web/public/brand/`.
- Logos adicionadas também em `apps/web/public/branding/zelare/`.
- Logo antiga em `apps/web/public/branding/cocris/logo-cocris.png` foi substituída por uma logo Zelare para manter compatibilidade com caminhos antigos.
- Favicon e `apple-touch-icon` criados.
- `apps/web/index.html` atualizado com título, descrição, favicon e theme color do Zelare.
- Tela de login atualizada com marca, cores, textos e CTA do Zelare.
- Sidebar atualizada com logo e fallback do Zelare.
- PWA/manifest atualizado no `apps/web/vite.config.ts`.
- Variáveis de exemplo do frontend e API ajustadas para nomenclatura Zelare.
- Pacotes principais renomeados para `@zelare/*` onde seguro.
- README principal substituído por introdução oficial do Zelare.
- Criado `BRANDING_ZELARE.md` com orientação de marca.

## Segurança

- Nenhuma migration foi criada.
- Nenhum arquivo de migration existente foi alterado intencionalmente.
- Nenhuma alteração estrutural de banco foi feita.
- O arquivo real `apps/web/.env.production` foi removido do pacote final para evitar versionamento de variáveis reais.
- O pacote final não inclui `node_modules` nem `dist`.

## Validação realizada

Foi executado build do frontend com Vite:

```bash
cd apps/web
npm ci --ignore-scripts --no-audit --no-fund
npx vite build
```

Resultado: o build Vite foi concluído com sucesso.

Observação: o comando completo `npm run build` chama `tsc -b && vite build`; o `tsc -b` demorou mais que o limite da sessão e não foi concluído aqui. No servidor/Coolify, o build completo deve ser executado normalmente.

## Próxima ordem recomendada

1. Subir o ZIP no repositório novo ou substituir os arquivos no clone local.
2. Conferir no GitHub Desktop se não há `.env`, `node_modules`, `dist`, `.zip`, `.tar.gz`, `.dump` ou backup sendo commitado.
3. Fazer commit:
   - Summary: `Personaliza identidade inicial do Zelare`
   - Description: `Atualiza nome, logos, favicon, textos institucionais e identidade visual inicial do projeto Zelare, preservando a base funcional existente e sem alterações de banco ou migrations.`
4. Fazer push.
5. Configurar variáveis no Coolify.
6. Rodar migrations somente se houver alterações futuras em schema/banco.
7. Fazer redeploy.
