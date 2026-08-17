#!/usr/bin/env node
/**
 * Seed idempotente de contas fictícias para homologação do Zelare.
 *
 * Segurança operacional:
 *   - nunca executa por padrão;
 *   - exige APPLY_TEST_SEED=true;
 *   - em produção exige ALLOW_PRODUCTION_TEST_SEED=true;
 *   - exige TEST_SEED_CONFIRMATION=ZELARE_FAKE_USERS_ONLY;
 *   - cria somente endereços do domínio .test;
 *   - não remove usuários, papéis ou escopos existentes.
 *
 * Uso seguro em homologação:
 *   APPLY_TEST_SEED=true \
 *   TEST_SEED_CONFIRMATION=ZELARE_FAKE_USERS_ONLY \
 *   TEST_USERS_PASSWORD='defina-uma-senha-de-teste' \
 *   node scripts/seed-test-users.js
 *
 * Para produção, a mesma execução também exige:
 *   ALLOW_PRODUCTION_TEST_SEED=true
 *
 * O script não executa migrações, não cria crianças e não insere dados pedagógicos.
 */

const {
  PrismaClient,
  RoleLevel,
  RoleType,
  UserStatus,
} = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const CONFIRMATION = 'ZELARE_FAKE_USERS_ONLY';
const TEST_DOMAIN = '.test';
const DEFAULT_PASSWORD = process.env.TEST_USERS_PASSWORD || 'Zelare@Teste2026!';
const isProduction = process.env.NODE_ENV === 'production';
const shouldApply = process.env.APPLY_TEST_SEED === 'true';
const isDryRun = process.env.DRY_RUN === 'true';

const TEST_MANTENEDORA_EMAIL = process.env.TEST_MANTENEDORA_EMAIL || 'mantenedora@zelare.test';
const TEST_MANTENEDORA_NAME = process.env.TEST_MANTENEDORA_NAME || 'Zelare — Instituição Fictícia de Teste';
const TEST_UNIT_CODE = process.env.TEST_UNIT_CODE || 'ZELARE-TESTE-01';
const TEST_UNIT_NAME = process.env.TEST_UNIT_NAME || 'Unidade Piloto Fictícia';

const TEST_USERS = [
  {
    key: 'developer',
    email: 'developer@zelare.test',
    firstName: 'Developer',
    lastName: 'Zelare — Teste',
    roleType: RoleType.DEVELOPER,
    roleLevel: RoleLevel.DEVELOPER,
    unitScoped: false,
    description: 'Acesso total para homologação técnica controlada.',
  },
  {
    key: 'mantenedora-geral',
    email: 'mantenedora.geral@zelare.test',
    firstName: 'Mantenedora',
    lastName: 'Geral — Teste',
    roleType: RoleType.MANTENEDORA_ADMIN,
    roleLevel: RoleLevel.MANTENEDORA,
    unitScoped: false,
    description: 'Gestão administrativa global da instituição fictícia.',
  },
  {
    key: 'coordenacao-geral',
    email: 'coordenacao.geral@zelare.test',
    firstName: 'Coordenação',
    lastName: 'Geral — Teste',
    roleType: RoleType.STAFF_CENTRAL_PEDAGOGICO,
    roleLevel: RoleLevel.STAFF_CENTRAL,
    unitScoped: false,
    description: 'Coordenação pedagógica central da instituição fictícia.',
  },
  {
    key: 'psicologia',
    email: 'psicologia@zelare.test',
    firstName: 'Psicologia',
    lastName: 'Escolar — Teste',
    roleType: RoleType.STAFF_CENTRAL_PSICOLOGIA,
    roleLevel: RoleLevel.STAFF_CENTRAL,
    unitScoped: false,
    description: 'Acompanhamento psicológico escolar com escopo central.',
  },
  {
    key: 'diretor-unidade',
    email: 'diretor.unidade@zelare.test',
    firstName: 'Diretor',
    lastName: 'de Unidade — Teste',
    roleType: RoleType.UNIDADE_DIRETOR,
    roleLevel: RoleLevel.UNIDADE,
    unitScoped: true,
    description: 'Direção da unidade piloto fictícia.',
  },
  {
    key: 'secretaria',
    email: 'secretaria@zelare.test',
    firstName: 'Secretaria',
    lastName: 'Escolar — Teste',
    roleType: RoleType.UNIDADE_ADMINISTRATIVO,
    roleLevel: RoleLevel.UNIDADE,
    unitScoped: true,
    description: 'Secretaria e administração da unidade piloto fictícia.',
  },
  {
    key: 'nutricionista',
    email: 'nutricionista@zelare.test',
    firstName: 'Nutricionista',
    lastName: 'Escolar — Teste',
    roleType: RoleType.UNIDADE_NUTRICIONISTA,
    roleLevel: RoleLevel.UNIDADE,
    unitScoped: true,
    description: 'Nutrição, cardápios e restrições alimentares da unidade piloto.',
  },
  {
    key: 'coordenador-unidade',
    email: 'coordenador.unidade@zelare.test',
    firstName: 'Coordenador',
    lastName: 'de Unidade — Teste',
    roleType: RoleType.UNIDADE_COORDENADOR_PEDAGOGICO,
    roleLevel: RoleLevel.UNIDADE,
    unitScoped: true,
    description: 'Coordenação pedagógica da unidade piloto fictícia.',
  },
  {
    key: 'professor',
    email: 'professor@zelare.test',
    firstName: 'Professor',
    lastName: 'de Teste',
    roleType: RoleType.PROFESSOR,
    roleLevel: RoleLevel.PROFESSOR,
    unitScoped: true,
    description: 'Professor vinculado à unidade piloto fictícia.',
  },
  {
    key: 'financeiro',
    email: 'financeiro@zelare.test',
    firstName: 'Financeiro',
    lastName: 'Escolar — Teste',
    roleType: RoleType.MANTENEDORA_FINANCEIRO,
    roleLevel: RoleLevel.MANTENEDORA,
    unitScoped: false,
    description: 'Perfil adicional para homologar folha, pagamentos e compras.',
  },
];

function assertSafeConfiguration() {
  if (process.env.TEST_SEED_CONFIRMATION !== CONFIRMATION) {
    throw new Error(`Defina TEST_SEED_CONFIRMATION=${CONFIRMATION} para confirmar que todos os usuários são fictícios.`);
  }

  if (!shouldApply && !isDryRun) {
    throw new Error('Seed bloqueado. Use APPLY_TEST_SEED=true ou DRY_RUN=true.');
  }

  if (isProduction && process.env.ALLOW_PRODUCTION_TEST_SEED !== 'true' && !isDryRun) {
    throw new Error('Seed bloqueado em produção. Use ALLOW_PRODUCTION_TEST_SEED=true somente após aprovação explícita.');
  }

  if (!TEST_MANTENEDORA_EMAIL.endsWith(TEST_DOMAIN)) {
    throw new Error(`TEST_MANTENEDORA_EMAIL deve terminar em ${TEST_DOMAIN}.`);
  }

  for (const user of TEST_USERS) {
    if (!user.email.endsWith(TEST_DOMAIN)) {
      throw new Error(`Usuário de teste fora do domínio permitido: ${user.email}`);
    }
  }

  if (DEFAULT_PASSWORD.length < 12) {
    throw new Error('TEST_USERS_PASSWORD deve ter pelo menos 12 caracteres.');
  }
}

async function ensureTenant() {
  return prisma.mantenedora.upsert({
    where: { email: TEST_MANTENEDORA_EMAIL },
    update: { isActive: true, name: TEST_MANTENEDORA_NAME },
    create: {
      name: TEST_MANTENEDORA_NAME,
      email: TEST_MANTENEDORA_EMAIL,
      country: 'BR',
      plan: 'professional',
      maxUnits: 10,
      maxUsers: 100,
      isActive: true,
    },
  });
}

async function ensureUnit(mantenedoraId) {
  return prisma.unit.upsert({
    where: { mantenedoraId_code: { mantenedoraId, code: TEST_UNIT_CODE } },
    update: { name: TEST_UNIT_NAME, isActive: true },
    create: {
      mantenedoraId,
      name: TEST_UNIT_NAME,
      code: TEST_UNIT_CODE,
      city: 'Brasília',
      state: 'DF',
      capacity: 100,
      ageGroupsServed: '0-5',
      isActive: true,
    },
  });
}

async function ensureRole(mantenedoraId, userData) {
  return prisma.role.upsert({
    where: { mantenedoraId_type: { mantenedoraId, type: userData.roleType } },
    update: {
      name: userData.roleType,
      description: userData.description,
      level: userData.roleLevel,
      isActive: true,
    },
    create: {
      mantenedoraId,
      name: userData.roleType,
      description: userData.description,
      level: userData.roleLevel,
      type: userData.roleType,
      isActive: true,
      isCustom: false,
    },
  });
}

async function ensureUser(mantenedoraId, unitId, role, userData, passwordHash) {
  const user = await prisma.user.upsert({
    where: { email: userData.email },
    update: {
      mantenedoraId,
      unitId: userData.unitScoped ? unitId : null,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: passwordHash,
      status: UserStatus.ATIVO,
      emailVerified: true,
    },
    create: {
      mantenedoraId,
      unitId: userData.unitScoped ? unitId : null,
      email: userData.email,
      password: passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      status: UserStatus.ATIVO,
      emailVerified: true,
    },
  });

  const userRole = await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: { scopeLevel: userData.roleLevel, isActive: true },
    create: {
      userId: user.id,
      roleId: role.id,
      scopeLevel: userData.roleLevel,
      isActive: true,
    },
  });

  if (userData.unitScoped) {
    await prisma.userRoleUnitScope.upsert({
      where: { userRoleId_unitId: { userRoleId: userRole.id, unitId } },
      update: {},
      create: { userRoleId: userRole.id, unitId },
    });
  } else {
    await prisma.userRoleUnitScope.deleteMany({ where: { userRoleId: userRole.id } });
  }

  return user;
}

async function main() {
  assertSafeConfiguration();

  console.log(`Modo: ${isDryRun ? 'DRY-RUN — nenhuma escrita' : 'APLICAÇÃO CONTROLADA'}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'não informado'}`);
  console.log(`Perfis: ${TEST_USERS.length}`);

  if (isDryRun) {
    console.table(TEST_USERS.map(({ key, email, roleType, unitScoped }) => ({ key, email, roleType, unitScoped })));
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const tenant = await ensureTenant();
  const unit = await ensureUnit(tenant.id);
  const results = [];

  for (const userData of TEST_USERS) {
    const role = await ensureRole(tenant.id, userData);
    const user = await ensureUser(tenant.id, unit.id, role, userData, passwordHash);
    results.push({ email: user.email, roleType: userData.roleType, unit: userData.unitScoped ? unit.code : 'REDE' });
  }

  console.table(results);
  console.log(`\nSenha comum dos testes: ${process.env.TEST_USERS_PASSWORD ? '[fornecida por variável]' : DEFAULT_PASSWORD}`);
  console.log('Essas contas são fictícias e devem permanecer restritas à homologação.');
}

main()
  .catch((error) => {
    console.error('Seed de usuários de teste abortado:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
