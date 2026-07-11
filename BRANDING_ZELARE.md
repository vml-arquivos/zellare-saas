# Personalização inicial Zelare

## Marca

Nome oficial: **Zelare**  
Slogan: **cuidado, pedagogia e gestão inteligente**

## Arquivos adicionados

```text
apps/web/public/brand/
apps/web/public/branding/zelare/
```

## Alterações realizadas

- Atualização do título do navegador para Zelare.
- Atualização do favicon e apple touch icon.
- Substituição da logo antiga pela marca Zelare no login e sidebar.
- Atualização de textos institucionais principais.
- Atualização de variáveis de exemplo do frontend.
- Remoção do arquivo `apps/web/.env.production` do pacote final para evitar versionamento de variáveis reais.

## Não realizado nesta etapa

- Nenhuma migration foi criada.
- Nenhuma alteração foi feita no schema Prisma.
- Não houve alteração estrutural no banco.
- Não houve alteração intencional em nomes técnicos de rotas, tabelas, modelos, endpoints ou funções internas que poderiam quebrar compatibilidade.

## Próxima etapa recomendada

1. Commit e push no repositório novo.
2. Conferir build do frontend.
3. Configurar variáveis no Coolify.
4. Rodar migrations somente se houver mudanças futuras no schema.
5. Fazer redeploy.
