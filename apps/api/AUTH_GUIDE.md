# Guia de Autenticação e RBAC - Zelare

**Autor:** MANUZ, Engenheiro de Software Sênior
**Data:** 03 de Fevereiro de 2026

Este guia explica como funciona o sistema de autenticação e controle de acesso (RBAC) do Zelare, incluindo exemplos práticos de uso.

---

## 1. Visão Geral

O Zelare implementa um sistema de autenticação e autorização robusto baseado em:

- **JWT (JSON Web Tokens)**: Para autenticação stateless
- **RBAC (Role-Based Access Control)**: Para controle de acesso baseado em papéis
- **Multi-tenancy**: Isolamento de dados por mantenedora → unidade → turma
- **Escopo de Acesso**: Validação automática de permissões por escopo

## 2. Endpoints de Autenticação

### 2.1. Login

**Endpoint:** `POST /auth/login`

**Body:**
```json
{
  "email": "contact@example.invalid",
  "password": "senha123"
}
```

**Resposta de Sucesso (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1234567890",
    "email": "contact@example.invalid",
    "firstName": "João",
    "lastName": "Silva",
    "mantenedoraId": "clx0987654321",
    "unitId": "clx1111111111",
    "roles": [
      {
        "roleId": "clx2222222222",
        "level": "PROFESSOR",
        "unitScopes": ["clx1111111111"]
      }
    ]
  }
}
```

### 2.2. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Resposta de Sucesso (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 3. Hierarquia de Papéis (RoleLevel)

| Nível | Descrição | Escopo de Acesso |
|:---|:---|:---|
| `DEVELOPER` | Acesso total sistêmico | Bypass completo (todos os dados) |
| `MANTENEDORA` | Gestão administrativa global | Todos os dados da mantenedora |
| `STAFF_CENTRAL` | Coordenação pedagógica e psicologia | Múltiplas unidades específicas |
| `UNIDADE` | Direção, coordenação, admin, nutrição | Todos os dados da unidade |
| `PROFESSOR` | Professor titular ou auxiliar | Apenas suas turmas |

---

## 4. Guards e Decorators

### 4.1. Decorators Disponíveis

#### `@Public()`
Marca uma rota como pública (não requer autenticação).

```typescript
@Public()
@Get('public')
getPublic() {
  return { message: 'Rota pública' };
}
```

#### `@RequireRoles(...roles)`
Define os níveis de acesso (RoleLevel) necessários.

```typescript
@RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA)
@Get('admin-only')
getAdminOnly() {
  return { message: 'Acesso restrito' };
}
```

#### `@RequirePermissions(...permissions)`
Define as permissões específicas necessárias (formato: `resource:action`).

```typescript
@RequirePermissions('children:read', 'children:update')
@Get('children')
getChildren() {
  return { message: 'Acesso com permissões' };
}
```

#### `@CurrentUser()`
Extrai o usuário autenticado do JWT.

```typescript
@Get('me')
getMe(@CurrentUser() user: JwtPayload) {
  return { user };
}
```

### 4.2. Guards Disponíveis

#### `JwtAuthGuard` (Global)
Valida o `accessToken` JWT em todas as rotas, exceto as marcadas com `@Public()`.

#### `RolesGuard`
Valida se o usuário possui o `RoleLevel` necessário.

#### `PermissionsGuard`
Valida se o usuário possui as permissões específicas.

#### `ScopeGuard`
Valida se o usuário tem acesso ao escopo (mantenedora, unidade, turma) do recurso.

---

## 5. Casos de Uso Obrigatórios

### 5.1. Professor só acessa suas turmas

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@RequireRoles(RoleLevel.PROFESSOR)
@Get('classroom/:classroomId/diary')
getClassroomDiary(
  @Param('classroomId') classroomId: string,
  @CurrentUser() user: JwtPayload,
) {
  // ScopeGuard valida que o professor está associado a esta turma
  return this.diaryService.findByClassroom(classroomId);
}
```

### 5.2. Direção acessa tudo da unidade

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@RequireRoles(RoleLevel.UNIDADE)
@Get('unidade/:unitId/children')
getUnitChildren(
  @Param('unitId') unitId: string,
  @CurrentUser() user: JwtPayload,
) {
  // ScopeGuard valida que o usuário pertence a esta unidade
  return this.childrenService.findByUnit(unitId);
}
```

### 5.3. Staff Central acessa apenas unidades vinculadas

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@RequireRoles(RoleLevel.STAFF_CENTRAL)
@Get('unidade/:unitId/reports')
getUnitReports(
  @Param('unitId') unitId: string,
  @CurrentUser() user: JwtPayload,
) {
  // ScopeGuard valida que a unitId está no array unitScopes do usuário
  return this.reportsService.findByUnit(unitId);
}
```

### 5.4. Mantenedora acessa tudo

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@RequireRoles(RoleLevel.MANTENEDORA)
@Get('mantenedora/:mantenedoraId/dashboard')
getMantenedoraDashboard(
  @Param('mantenedoraId') mantenedoraId: string,
  @CurrentUser() user: JwtPayload,
) {
  // ScopeGuard valida que o usuário pertence a esta mantenedora
  return this.dashboardService.getMantenedoraData(mantenedoraId);
}
```

### 5.5. Desenvolvedor é bypass sistêmico

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles(RoleLevel.DEVELOPER)
@Get('admin/all-data')
getAllData(@CurrentUser() user: JwtPayload) {
  // DEVELOPER bypassa todas as validações de escopo
  return this.adminService.getAllSystemData();
}
```

---

## 6. Exemplos de Requisições

### 6.1. Login e Obtenção de Tokens

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@example.invalid",
    "password": "senha123"
  }'
```

### 6.2. Acessar Rota Protegida

```bash
curl -X GET http://localhost:3000/example/protected \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_SECRET_MANAGER>"
```

### 6.3. Acessar Rota com Escopo

```bash
curl -X GET http://localhost:3000/unidade/clx1111111111/data \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_SECRET_MANAGER>"
```

---

## 7. Estrutura do JWT Payload

```typescript
{
  sub: string;              // userId
  email: string;            // email do usuário
  mantenedoraId: string;    // ID da mantenedora
  unitId?: string;          // ID da unidade (opcional)
  roles: [
    {
      roleId: string;       // ID do papel
      level: RoleLevel;     // Nível de acesso
      unitScopes: string[]; // Array de unitIds com acesso
    }
  ]
}
```

---

## 8. Boas Práticas

1. **Sempre use HTTPS em produção** para proteger os tokens JWT.
2. **Armazene o `refreshToken` de forma segura** no frontend (ex: HttpOnly cookies).
3. **Implemente logout** invalidando os tokens no cliente.
4. **Rotacione os secrets JWT** periodicamente.
5. **Use o `ScopeGuard`** em todas as rotas que acessam dados de mantenedora, unidade ou turma.
6. **Combine guards** quando necessário (ex: `RolesGuard` + `PermissionsGuard` + `ScopeGuard`).
7. **Audite os logs** para rastrear acessos e mudanças de permissão.

---

## 9. Troubleshooting

### Erro: "Unauthorized"
- Verifique se o token JWT está sendo enviado no header `Authorization: Bearer <token>`.
- Verifique se o token não expirou.
- Use o `refreshToken` para obter um novo `accessToken`.

### Erro: "Forbidden"
- Verifique se o usuário tem o `RoleLevel` necessário.
- Verifique se o usuário tem as permissões necessárias.
- Verifique se o usuário tem acesso ao escopo (mantenedora, unidade, turma).

### Erro: "Acesso negado: você não tem permissão para acessar dados desta unidade"
- Verifique se a `unitId` do parâmetro da rota corresponde à `unitId` do usuário (para `UNIDADE` e `PROFESSOR`).
- Para `STAFF_CENTRAL`, verifique se a `unitId` está no array `unitScopes` do usuário.

---

**O sistema de autenticação e RBAC do Zelare está pronto para uso!** 🔐✨
