# Zelare Web

Frontend premium do sistema Zelare desenvolvido com React, Vite, TypeScript e Shadcn/UI.

---

## 🚀 Tecnologias

- **React 19.2.4** - Framework UI
- **Vite 7.3.1** - Build tool
- **TypeScript 5.9.3** - Type safety
- **Tailwind CSS 3.4.19** - Styling
- **Shadcn/UI** - Componentes de UI Premium
- **Radix UI** - Primitivos acessíveis
- **Lucide React** - Ícones
- **Sonner** - Notificações (Toasts)
- **React Router DOM 7.13.0** - Roteamento
- **Axios 1.13.4** - HTTP client

---

## 🛠️ Desenvolvimento

### Instalação de Dependências

```bash
npm ci
```

### Executar em Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:5173

### Build de Produção

```bash
npm run build
```

---

## 🌐 Deploy no Coolify

### Configuração

**Build Command:**
```bash
npm ci && npm run build
```

**Output Directory:**
```
dist
```

**Variáveis de Ambiente:**
```env
VITE_API_BASE_URL=https://apiconexa.casadf.com.br
```

**Domínio Oficial:**
```
https://demo.zelare.seu-dominio.com.br
```

---

## 📁 Estrutura do Projeto

```
src/
├── api/                    # Camada de API
├── app/                    # Core da aplicação (Auth, Router, Guards)
├── components/
│   ├── dashboard/         # Componentes específicos do Dashboard
│   ├── layout/            # Layout SaaS (Sidebar, Topbar)
│   └── ui/                # Componentes Shadcn/UI & PageShell
├── hooks/                  # Custom hooks (useToast, etc)
├── lib/                    # Utilitários (cn, etc)
├── pages/                  # Páginas da aplicação
└── utils/                  # Helpers (pedagogicalDate, etc)
```

---

## 🛡️ Segurança & Regras

### Trava Pedagógica
O sistema possui uma **Trava Pedagógica** no Dashboard do Professor que impede registros caso não haja um planejamento ativo (`EM_EXECUCAO`) ou uma entrada curricular programada para a data atual.

### RBAC (Role-Based Access Control)
Acesso restrito por perfis. A rota `/app/professor` é protegida pelo `RoleProtectedRoute` e exige a role `PROFESSOR`.

---

## 📝 Licença

Proprietary - Todos os direitos reservados
