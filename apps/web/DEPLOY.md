# DEPLOY - FONT-ZELARE-V2

Instruções de deploy do frontend premium no Coolify.

---

## 🌐 CONFIGURAÇÃO NO COOLIFY

### 1. Variáveis de Ambiente

```env
VITE_API_BASE_URL=https://apiconexa.casadf.com.br
```

### 2. Build Configuration

**Build Command:**
```bash
npm ci && npm run build
```

**Output Directory:**
```
dist
```

**Node Version:**
```
20
```

### 3. Domínio Oficial

```
https://demo.zelare.seu-dominio.com.br
```

---

## 🛠️ COMANDOS LOCAIS

### Instalação de Dependências
```bash
npm ci
```

### Build de Produção
```bash
npm run build
```

---

## ✅ VALIDAÇÃO PÓS-DEPLOY

### 1. Acessibilidade
```bash
curl -I https://demo.zelare.seu-dominio.com.br
```
Resposta esperada: `HTTP/2 200`

### 2. Smoke Test: Dashboard do Professor
1. Acessar: `https://demo.zelare.seu-dominio.com.br/app/professor`
2. Verificar se o **PageShell** renderiza corretamente.
3. Verificar se a **Topbar** exibe a data pedagógica e o badge da turma.
4. Validar estados:
   - **Loading:** Skeletons aparecem durante o fetch.
   - **Blocked:** ErrorState aparece se não houver planejamento.
   - **Ready:** Painéis de registro rápido e feed aparecem.

### 3. Testar Notificações (Sonner)
1. Realizar um registro rápido (One-Touch).
2. Verificar se o **Toast (Sonner)** aparece no canto inferior direito com feedback de sucesso.

---

## 🔍 TROUBLESHOOTING

### Build falha com "Cannot find module"
Verifique se todos os componentes do `src/components/ui/` foram commitados.

### Erros de Estilo
Certifique-se de que o `tailwind.config.js` inclui os caminhos dos novos componentes.

---

## 🔄 ROLLBACK
Se houver problemas, reverta para o commit anterior e faça o redeploy no Coolify.

---

## 🔗 REFERÊNCIAS
- **Frontend:** https://demo.zelare.seu-dominio.com.br
- **API Backend:** https://apiconexa.casadf.com.br

---
**Última atualização:** 2026-02-07
