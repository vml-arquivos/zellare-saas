# PR22 — runbook de demonstração

## Pré-condições

Execute somente em ambiente de teste autorizado, com banco local/CI/domínio sintético. Nunca use a massa do ambiente público como fonte da demonstração. A fixture não é mecanismo de criação de produção.

```bash
export DATABASE_URL='postgresql://postgres@127.0.0.1:55432/zellare_pr22_demo_20260822?schema=public'
export DIRECT_URL="$DATABASE_URL"
export NODE_ENV=development
export ALLOW_SYNTHETIC_SEED=true
export DEMO_DATA_CONFIRMATION='PR22-DEMO-ONLY'
export PR22_DEMO_PASSWORD='<forneça somente no runtime>'
export JOURNEY_CONTACT_HMAC_SECRET='<forneça somente no runtime>'
export JOURNEY_CONTACT_ENCRYPTION_SECRET='<forneça somente no runtime>'
pnpm --filter @zelare/api seed:demo
```

A fixture é somente-upsert, usa IDs estáveis `pr22-demo-*` e pode ser reaplicada sem apagar registros ou criar duplicatas. O seed padrão continua sem inserir dados. Não registrar senha, segredo, token, contato real ou conteúdo de produção em logs, screenshots, HAR ou Git.

## Contas sintéticas

| Perfil | Login sintético | Uso |
|---|---|---|
| Administrador de unidade | `pr22-admin@demo.invalid` | Dashboard administrativo e capacidade |
| Admissões central | `pr22-admissions@demo.invalid` | Captação, visitas, lista, ofertas, aceite e tarefas Journey |
| Direção | `pr22-director@demo.invalid` | Revisão/publicação de política |
| Professor | `pr22-teacher@demo.invalid` | Dashboard, chamada, diário, desenvolvimento; sem Journey |
| Família | `pr22-family@demo.invalid` | Timeline e mensagens protegidas da criança vinculada |

A mesma senha é recebida por `PR22_DEMO_PASSWORD` no runtime. Ela não deve ser escrita neste arquivo, em commits ou em artefatos.

## Sequência comprovada

1. Abra o login local e autentique um perfil sintético.
2. No dashboard, confirme `Unidade Demo Sintética`, `Turma Descobertas`, quatro crianças, presença, planejamento e registros.
3. Com o professor, abra Desenvolvimento e Diário; confirme URL com `classroomId` válido e o bloqueio esperado de sábado não letivo quando aplicável.
4. Abra Família/LGPD, selecione `Lumi Demo 01` e confirme privacidade aplicada, consentimento ativo, timeline e mensagens protegidas.
5. Envie uma mensagem neutra, como `Atualização PR22`, recarregue e selecione novamente a criança para confirmar persistência.
6. Saia e entre como `pr22-admissions@demo.invalid`.
7. Percorra as abas Visão geral, Interessados, Funil, Visitas, Lista de espera, Ofertas e Relatórios.
8. Cadastre um interessado sintético com e-mail `.invalid`, marque explicitamente consentimento de captação e contato e confirme a resposta; recarregue e confirme o registro.
9. Altere o estágio permitido, agende visita, confirme presença e recarregue; confirme `AGENDADA → REALIZADA` e o evento histórico.
10. Insira o interessado na lista de espera usando a política publicada; confirme pontuação, explicação e persistência.
11. Crie oferta com capacidade real, expiração futura e sem override; confirme o estado `OFERTADA`.
12. Aceite a oferta; confirme estado `ACEITA`, mensagem de rascunho incompleto e ausência de `Child`, matrícula definitiva, contrato, cobrança ou pagamento novo.
13. Abra Journey com `pr22-teacher@demo.invalid`; confirme redirecionamento e 403 direto da API.
14. Repita a navegação em 320, 360, 390, 412, 768 e 1280 px; confirme ausência de overflow horizontal e console limpo.

## Protocolo por ação

Para cada salvar, criar, editar, agendar, concluir, aceitar ou recusar, registre `AÇÃO → REQUEST → RESPONSE → RELOAD → CONFIRMAÇÃO`. Classifique 4xx esperados, investigue qualquer 5xx, confira console e Network e salve apenas evidências redigidas.

## Evidências desta execução

As screenshots, o console `CLEAN`, o HAR sanitizado e os logs estão em `/home/ubuntu/research_zelare/onda3_journey_20260822/pr22-playwright-final/` e `/home/ubuntu/research_zelare/onda3_journey_20260822/final-logs/`. O HAR bruto foi apagado após sanitização; nenhum JWT Bearer ou senha de runtime permanece no artefato final.

## Encerramento

Não declare `GO` se houver loader infinito, tela vazia sem explicação, erro relevante de console, 5xx não investigado, estado que desaparece após reload, acesso indevido, overflow, migration bloqueada ou evidência ausente. Nesta PR22, o replay de migrations históricas e o lint global permanecem bloqueados; portanto o encerramento correto é `NO-GO PARA MERGE/DEPLOY`.
