# ✅ Checklist de Deploy - Zelare

**Data de Deploy**: ___/___/______  
**Responsável**: _______________________  
**Ambiente**: Produção

---

## 📋 PRÉ-DEPLOY

### Preparação
- [ ] Repositório GitHub atualizado (branch `main`)
- [ ] Todas as PRs mergeadas
- [ ] Build local passou sem erros
- [ ] Testes executados com sucesso
- [ ] Documentação atualizada

### Credenciais
- [ ] Acesso ao Coolify confirmado
- [ ] Credenciais do GitHub configuradas
- [ ] Senhas fortes geradas (JWT, DB)
- [ ] API keys obtidas (AWS, Gemini, etc.)

### Infraestrutura
- [ ] VPS provisionada e acessível
- [ ] Domínios registrados
- [ ] DNS configurado
- [ ] SSL/TLS planejado

---

## 🗄️ BANCO DE DADOS

### Criação
- [ ] PostgreSQL criado no Coolify
- [ ] Nome do banco: `conexa`
- [ ] Usuário criado: `zelare_user`
- [ ] Senha forte definida e anotada
- [ ] Connection string obtida

### Validação
- [ ] Status: **Running** (verde)
- [ ] Conexão testada
- [ ] Port: 5432 acessível

---

## 🔧 BACKEND API

### Configuração
- [ ] Aplicação criada no Coolify
- [ ] Nome: `zelare-saas-api`
- [ ] Repositório conectado
- [ ] Branch: `main`
- [ ] Build command configurado
- [ ] Start command configurado
- [ ] Port: 3000

### Variáveis de Ambiente
- [ ] `DATABASE_URL` configurado
- [ ] `JWT_SECRET` configurado (32+ caracteres)
- [ ] `JWT_EXPIRES_IN` configurado
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] `API_URL` configurado
- [ ] `CORS_ORIGIN` configurado
- [ ] AWS S3 configurado (se necessário)
- [ ] Gemini AI configurado (se necessário)

### Deploy
- [ ] Deploy iniciado
- [ ] Build passou sem erros
- [ ] Logs verificados
- [ ] Status: **Running** (verde)

### Migrations
- [ ] Migrations executadas: `npx prisma migrate deploy`
- [ ] Sucesso confirmado
- [ ] Tabelas criadas no banco

### Usuário Admin
- [ ] Script `create-admin.js` executado
- [ ] Email: `contact@example.invalid`
- [ ] Senha anotada
- [ ] Login testado

### Validação
- [ ] Health check: `/health` retorna `{"status":"ok"}`
- [ ] Logs sem erros críticos
- [ ] CPU < 70%
- [ ] RAM < 80%

---

## 🎨 FRONTEND WEB

### Configuração
- [ ] Aplicação criada no Coolify
- [ ] Nome: `zelare-saas-web`
- [ ] Repositório conectado
- [ ] Build command configurado
- [ ] Output directory: `apps/web/dist`
- [ ] Port: 5173

### Variáveis de Ambiente
- [ ] `VITE_API_URL` configurado
- [ ] `VITE_API_TIMEOUT` configurado
- [ ] `VITE_APP_NAME` configurado
- [ ] `VITE_APP_VERSION` configurado
- [ ] Features flags configuradas

### Deploy
- [ ] Deploy iniciado
- [ ] Build passou sem erros
- [ ] Logs verificados
- [ ] Status: **Running** (verde)

### Validação
- [ ] Homepage carrega
- [ ] Tela de login aparece
- [ ] Console sem erros
- [ ] Assets carregam (CSS, JS, imagens)

---

## 🌐 SITE INSTITUCIONAL

### Configuração
- [ ] Aplicação criada no Coolify
- [ ] Nome: `zelare-saas-site`
- [ ] Repositório conectado
- [ ] Build command configurado
- [ ] Start command configurado
- [ ] Port: 5174

### Variáveis de Ambiente
- [ ] `DATABASE_URL` configurado
- [ ] `API_URL` configurado
- [ ] `NODE_ENV=production`
- [ ] `PORT=5174`

### Deploy
- [ ] Deploy iniciado
- [ ] Build passou sem erros
- [ ] Logs verificados
- [ ] Status: **Running** (verde)

### Validação
- [ ] Homepage carrega
- [ ] Navegação funciona
- [ ] Console sem erros

---

## 🔒 DOMÍNIOS E SSL

### Backend API
- [ ] Domínio configurado: `api.conexa.seu-dominio.com`
- [ ] DNS propagado
- [ ] SSL ativo (cadeado verde)
- [ ] HTTPS funciona

### Frontend Web
- [ ] Domínio configurado: `app.conexa.seu-dominio.com`
- [ ] DNS propagado
- [ ] SSL ativo (cadeado verde)
- [ ] HTTPS funciona

### Site Institucional
- [ ] Domínio configurado: `conexa.seu-dominio.com`
- [ ] DNS propagado
- [ ] SSL ativo (cadeado verde)
- [ ] HTTPS funciona

---

## 🧪 TESTES DE INTEGRAÇÃO

### Autenticação
- [ ] Login com admin funciona
- [ ] Token JWT é gerado
- [ ] Logout funciona
- [ ] Sessão persiste após refresh

### Dashboard
- [ ] Dashboard carrega após login
- [ ] Gráficos aparecem
- [ ] Dados são carregados da API
- [ ] Sem erros no console

### Funcionalidades
- [ ] Seleção de crianças funciona
- [ ] Seleção de materiais funciona
- [ ] Micro-gestos funcionam
- [ ] Replicação de planejamentos funciona
- [ ] Upload de arquivos funciona (se configurado)

### Performance
- [ ] Tempo de carregamento < 3s
- [ ] API responde em < 500ms
- [ ] Sem memory leaks
- [ ] Bundle size aceitável

---

## 📊 MONITORAMENTO

### Logs
- [ ] Logs acessíveis no Coolify
- [ ] Auto-scroll ativado
- [ ] Nível de log: `info`
- [ ] Sem erros críticos

### Health Checks
- [ ] Health check configurado: `/health`
- [ ] Intervalo: 30s
- [ ] Timeout: 10s
- [ ] Retries: 3

### Alertas
- [ ] Notificações configuradas (email/webhook)
- [ ] Alerta de down configurado
- [ ] Alerta de CPU alto configurado
- [ ] Alerta de RAM alto configurado

### Métricas
- [ ] CPU monitorada
- [ ] RAM monitorada
- [ ] Disco monitorado
- [ ] Network monitorada

---

## 🔐 SEGURANÇA

### Configurações
- [ ] HTTPS ativo em todos os domínios
- [ ] CORS configurado corretamente
- [ ] Rate limiting ativo
- [ ] Helmet ativo (segurança HTTP)
- [ ] Senhas fortes em uso

### Secrets
- [ ] JWT_SECRET forte (32+ caracteres)
- [ ] Senha do banco forte
- [ ] API keys seguras
- [ ] Secrets não commitados no Git

### Backup
- [ ] Backup automático configurado
- [ ] Horário: 02:00 (diário)
- [ ] Retenção: 30 dias
- [ ] Backup testado (restore)

---

## 📚 DOCUMENTAÇÃO

### Atualizada
- [ ] README.md atualizado
- [ ] GUIA_DEPLOY_COOLIFY_PASSO_A_PASSO.md revisado
- [ ] Variáveis de ambiente documentadas
- [ ] Changelog atualizado

### Acessível
- [ ] Documentação no repositório
- [ ] Links funcionando
- [ ] Exemplos claros
- [ ] Troubleshooting completo

---

## 🎓 TREINAMENTO

### Equipe
- [ ] Equipe treinada no sistema
- [ ] Acesso fornecido
- [ ] Credenciais distribuídas
- [ ] Suporte disponível

### Usuários
- [ ] Manual do usuário criado
- [ ] Vídeos tutoriais gravados (opcional)
- [ ] FAQ preparado
- [ ] Canal de suporte definido

---

## 🚀 PÓS-DEPLOY

### Validação Final
- [ ] Todos os serviços: **Running** (verde)
- [ ] Todos os domínios com SSL ativo
- [ ] Login funciona
- [ ] Dashboard funciona
- [ ] Funcionalidades principais testadas

### Comunicação
- [ ] Stakeholders notificados
- [ ] Usuários informados
- [ ] Data de go-live comunicada
- [ ] Suporte preparado

### Monitoramento Inicial
- [ ] Monitorar logs por 24h
- [ ] Verificar métricas a cada 1h
- [ ] Responder a alertas rapidamente
- [ ] Documentar issues

---

## 📝 ROLLBACK PLAN

### Preparação
- [ ] Versão anterior identificada
- [ ] Procedimento de rollback documentado
- [ ] Backup recente disponível
- [ ] Equipe ciente do plano

### Em Caso de Falha Crítica
1. [ ] Identificar a falha
2. [ ] Notificar stakeholders
3. [ ] Executar rollback no Coolify
4. [ ] Validar versão anterior
5. [ ] Investigar causa raiz
6. [ ] Planejar correção

---

## ✅ APROVAÇÃO FINAL

### Checklist Completo
- [ ] Todos os itens acima verificados
- [ ] Nenhum blocker identificado
- [ ] Sistema estável por 24h
- [ ] Performance aceitável
- [ ] Segurança validada

### Assinaturas

**Desenvolvedor**:  
Nome: _______________________  
Data: ___/___/______  
Assinatura: _______________________

**Líder Técnico**:  
Nome: _______________________  
Data: ___/___/______  
Assinatura: _______________________

**Product Owner**:  
Nome: _______________________  
Data: ___/___/______  
Assinatura: _______________________

---

## 🎉 DEPLOY CONCLUÍDO!

**Data de Conclusão**: ___/___/______  
**Hora**: ___:___  
**Status**: ✅ SUCESSO / ❌ FALHOU  

**Observações**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**Desenvolvido por**: Manus AI Agent  
**Última atualização**: 19 de Fevereiro de 2026  
**Versão do Checklist**: 1.0.0
