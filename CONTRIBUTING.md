# Guia de Contribuição - Zelare

Obrigado por considerar contribuir com o Zelare! 🎉

## Código de Conduta

Este projeto segue um Código de Conduta. Ao participar, você concorda em manter um ambiente respeitoso e acolhedor.

---

## Como Contribuir

### 1. Fork e Clone

```bash
# Fork o repositório no GitHub
# Depois clone seu fork
git clone https://github.com/SEU_USUARIO/zelare-saas.git
cd zelare-saas
```

### 2. Configurar Ambiente

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Gerar Prisma Client
pnpm db:generate

# Executar migrations
pnpm db:migrate:dev

# Seed do banco
pnpm db:seed
```

### 3. Criar Branch

```bash
# Sempre crie uma branch a partir da main
git checkout -b feature/nome-da-feature

# Ou para correções
git checkout -b fix/nome-do-bug
```

### 4. Fazer Alterações

- Escreva código limpo e bem documentado
- Siga os padrões de código do projeto
- Adicione testes quando aplicável
- Atualize a documentação se necessário

### 5. Commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Formato: tipo(escopo): descrição

# Exemplos:
git commit -m "feat(api): adiciona endpoint de relatórios"
git commit -m "fix(web): corrige bug no login"
git commit -m "docs: atualiza README"
git commit -m "refactor(database): otimiza queries"
```

**Tipos de commit**:
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação (não afeta código)
- `refactor`: Refatoração
- `test`: Adiciona ou corrige testes
- `chore`: Tarefas de manutenção

### 6. Push e Pull Request

```bash
# Push para seu fork
git push origin feature/nome-da-feature

# Abra um Pull Request no GitHub
```

**Template de PR**:

```markdown
## Descrição
Breve descrição das mudanças

## Tipo de mudança
- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Breaking change
- [ ] Documentação

## Checklist
- [ ] Código segue os padrões do projeto
- [ ] Testes foram adicionados/atualizados
- [ ] Documentação foi atualizada
- [ ] Build passa sem erros
- [ ] Testes passam
```

---

## Padrões de Código

### TypeScript

- Use TypeScript estrito
- Sempre defina tipos explícitos
- Evite `any`
- Use interfaces para objetos

```typescript
// ✅ Bom
interface User {
  id: string;
  name: string;
}

function getUser(id: string): User {
  // ...
}

// ❌ Ruim
function getUser(id: any): any {
  // ...
}
```

### React

- Use componentes funcionais
- Use hooks
- Extraia lógica complexa em custom hooks
- Nomeie componentes com PascalCase

```tsx
// ✅ Bom
export function UserProfile({ userId }: { userId: string }) {
  const { user, loading } = useUser(userId);
  
  if (loading) return <Spinner />;
  
  return <div>{user.name}</div>;
}

// ❌ Ruim
export default function userProfile(props) {
  // ...
}
```

### NestJS

- Use decorators apropriados
- Separe lógica em services
- Valide DTOs com class-validator
- Use Guards para autorização

```typescript
// ✅ Bom
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  
  @Get(':id')
  @RequireRoles(RoleLevel.MANTENEDORA)
  async getUser(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

### Prisma

- Use nomes descritivos para models
- Adicione índices apropriados
- Documente campos complexos
- Use enums quando aplicável

```prisma
// ✅ Bom
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  mantenedoraId String
  
  mantenedora Mantenedora @relation(fields: [mantenedoraId], references: [id])
  
  @@index([mantenedoraId])
  @@index([email])
}
```

---

## Estrutura de Arquivos

### Backend (API)

```
apps/api/src/
├── auth/              # Módulo de autenticação
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   └── guards/
├── users/             # Módulo de usuários
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── dto/
└── common/            # Código compartilhado
    ├── decorators/
    ├── filters/
    └── interceptors/
```

### Frontend (Web)

```
apps/web/src/
├── components/        # Componentes React
│   ├── ui/           # Componentes UI básicos
│   └── features/     # Componentes específicos
├── pages/            # Páginas da aplicação
├── hooks/            # Custom hooks
├── lib/              # Bibliotecas e utilitários
├── api/              # Cliente API
└── types/            # Tipos TypeScript
```

---

## Testes

### Backend

```bash
# Executar testes
cd apps/api && pnpm test

# Testes com coverage
pnpm test:cov

# Testes E2E
pnpm test:e2e
```

**Exemplo de teste**:

```typescript
describe('UsersService', () => {
  let service: UsersService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();
    
    service = module.get<UsersService>(UsersService);
  });
  
  it('should find user by id', async () => {
    const user = await service.findOne('user-id');
    expect(user).toBeDefined();
    expect(user.id).toBe('user-id');
  });
});
```

### Frontend

```bash
# Executar testes
cd apps/web && pnpm test
```

---

## Documentação

### Comentários de Código

- Use JSDoc para funções públicas
- Explique o "porquê", não o "o quê"
- Mantenha comentários atualizados

```typescript
/**
 * Calcula a idade da criança com base na data de nascimento
 * 
 * @param birthDate - Data de nascimento no formato ISO
 * @returns Idade em anos completos
 */
export function calculateAge(birthDate: string): number {
  // Implementação
}
```

### README

- Atualize o README se adicionar novas funcionalidades
- Adicione exemplos de uso
- Documente variáveis de ambiente

---

## Processo de Review

### O que esperamos

1. **Código limpo**: Fácil de ler e entender
2. **Testes**: Funcionalidades testadas
3. **Documentação**: Mudanças documentadas
4. **Sem breaking changes**: Ou justificados

### Processo

1. Automated checks (CI/CD)
2. Code review por mantenedor
3. Feedback e ajustes
4. Aprovação e merge

---

## Reportar Bugs

Use o [GitHub Issues](https://github.com/vml-arquivos/zelare-saas/issues) com o template:

```markdown
## Descrição do Bug
Descrição clara do problema

## Passos para Reproduzir
1. Vá para '...'
2. Clique em '...'
3. Veja o erro

## Comportamento Esperado
O que deveria acontecer

## Screenshots
Se aplicável

## Ambiente
- OS: [e.g. Ubuntu 22.04]
- Node: [e.g. 20.11.0]
- Browser: [e.g. Chrome 120]
```

---

## Sugerir Funcionalidades

Use o [GitHub Issues](https://github.com/vml-arquivos/zelare-saas/issues) com o template:

```markdown
## Descrição da Funcionalidade
Descrição clara da funcionalidade

## Problema que Resolve
Qual problema esta funcionalidade resolve?

## Solução Proposta
Como você imagina que funcione?

## Alternativas Consideradas
Outras formas de resolver o problema
```

---

## Dúvidas?

- Abra uma [Discussion](https://github.com/vml-arquivos/zelare-saas/discussions)
- Entre em contato: contato@zelare.org

---

**Obrigado por contribuir! 🙏**
