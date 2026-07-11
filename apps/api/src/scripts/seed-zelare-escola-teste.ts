import { PrismaClient, RoleLevel, RoleType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed de uma instituição teste completa do Zelare — escola, turmas, e um
 * usuário de login pronto para CADA papel de acesso que o sistema suporta.
 * Idempotente (upsert em tudo): pode rodar mais de uma vez sem duplicar.
 *
 *   cd apps/api && npx ts-node src/scripts/seed-zelare-escola-teste.ts
 */
async function main() {
  console.log('🌱 Criando instituição teste do Zelare...\n');

  const MANTENEDORA_ID = 'zelare-teste-mantenedora-001';
  const UNIT_ID = 'zelare-teste-unit-001';
  const CLASSROOM_BERCARIO_ID = 'zelare-teste-classroom-ei01';
  const CLASSROOM_BEM_PEQUENA_ID = 'zelare-teste-classroom-ei02';
  const CLASSROOM_PEQUENA_ID = 'zelare-teste-classroom-ei03';
  const FRAMEWORK_ID = 'zelare-teste-framework-inicial';

  const SENHA_PADRAO = 'Zelare#2026';
  const passwordHash = await bcrypt.hash(SENHA_PADRAO, 10);

  // ── 1. Mantenedora ────────────────────────────────────────────────────
  const mantenedora = await prisma.mantenedora.upsert({
    where: { id: MANTENEDORA_ID },
    update: {},
    create: {
      id: MANTENEDORA_ID,
      name: 'Escola Teste Zelare',
      email: 'contato@escolateste.zelare.com.br',
      phone: '11999990000',
      country: 'BR',
      taxIdType: 'NONE',
      city: 'São Paulo',
      state: 'SP',
      isActive: true,
      plan: 'professional',
      maxUnits: 5,
      maxUsers: 100,
    },
  });
  console.log('✅ Mantenedora:', mantenedora.name, `(${mantenedora.id})`);

  // ── 2. Branding de teste (exercita o TenantBranding da Fase 1) ────────
  await prisma.tenantBranding.upsert({
    where: { mantenedoraId: MANTENEDORA_ID },
    update: {},
    create: {
      mantenedoraId: MANTENEDORA_ID,
      displayName: 'Escola Teste Zelare',
      slogan: 'Ambiente de testes — não é dado real',
      primaryColor: '#1E3A8A',
      secondaryColor: '#0F6E56',
    },
  });
  console.log('✅ Branding de teste criado');

  // ── 3. Feature flags ligadas pra teste ─────────────────────────────────
  for (const flagKey of ['ia_assistiva', 'upload_conteudo_proprio', 'multiplos_frameworks_pedagogicos']) {
    await prisma.tenantFeatureFlag.upsert({
      where: { mantenedoraId_flagKey: { mantenedoraId: MANTENEDORA_ID, flagKey } },
      update: { enabled: true },
      create: { mantenedoraId: MANTENEDORA_ID, flagKey, enabled: true },
    });
  }
  console.log('✅ Feature flags de teste ligadas');

  // ── 4. Unidade ──────────────────────────────────────────────────────
  const unit = await prisma.unit.upsert({
    where: { id: UNIT_ID },
    update: {},
    create: {
      id: UNIT_ID,
      mantenedoraId: MANTENEDORA_ID,
      name: 'Unidade Piloto',
      code: 'PILOTO-01',
      address: 'Rua de Teste, 100',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      phone: '11988880000',
      email: 'piloto@escolateste.zelare.com.br',
      isActive: true,
    },
  });
  console.log('✅ Unidade:', unit.name);

  // ── 5. Turmas — uma por faixa etária (0 a 6 anos) ─────────────────────
  const bercario = await prisma.classroom.upsert({
    where: { id: CLASSROOM_BERCARIO_ID },
    update: {},
    create: {
      id: CLASSROOM_BERCARIO_ID,
      unitId: UNIT_ID,
      name: 'Berçário (EI01)',
      code: 'EI01-A',
      ageGroupMin: 0,
      ageGroupMax: 18,
      capacity: 12,
      isActive: true,
    },
  });
  const bemPequena = await prisma.classroom.upsert({
    where: { id: CLASSROOM_BEM_PEQUENA_ID },
    update: {},
    create: {
      id: CLASSROOM_BEM_PEQUENA_ID,
      unitId: UNIT_ID,
      name: 'Crianças Bem Pequenas (EI02)',
      code: 'EI02-A',
      ageGroupMin: 19,
      ageGroupMax: 47,
      capacity: 15,
      isActive: true,
    },
  });
  const pequena = await prisma.classroom.upsert({
    where: { id: CLASSROOM_PEQUENA_ID },
    update: {},
    create: {
      id: CLASSROOM_PEQUENA_ID,
      unitId: UNIT_ID,
      name: 'Crianças Pequenas (EI03)',
      code: 'EI03-A',
      ageGroupMin: 48,
      ageGroupMax: 71,
      capacity: 20,
      isActive: true,
    },
  });
  console.log('✅ 3 turmas criadas (Berçário, Bem Pequenas, Pequenas)');

  // ── 6. Um Role por papel de acesso que o sistema suporta ──────────────
  const roleDefs: { type: RoleType; level: RoleLevel; name: string }[] = [
    { type: 'DEVELOPER', level: 'DEVELOPER', name: 'Desenvolvedor' },
    { type: 'MANTENEDORA_ADMIN', level: 'MANTENEDORA', name: 'Administração Geral' },
    { type: 'STAFF_CENTRAL_PEDAGOGICO', level: 'STAFF_CENTRAL', name: 'Coordenação Pedagógica Central' },
    { type: 'STAFF_CENTRAL_PSICOLOGIA', level: 'STAFF_CENTRAL', name: 'Psicologia' },
    { type: 'UNIDADE_DIRETOR', level: 'UNIDADE', name: 'Direção da Unidade' },
    { type: 'UNIDADE_COORDENADOR_PEDAGOGICO', level: 'UNIDADE', name: 'Coordenação Pedagógica da Unidade' },
    { type: 'UNIDADE_ADMINISTRATIVO', level: 'UNIDADE', name: 'Secretaria' },
    { type: 'PROFESSOR', level: 'PROFESSOR', name: 'Professor' },
  ];

  const roles: Record<string, { id: string }> = {};
  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { mantenedoraId_type: { mantenedoraId: MANTENEDORA_ID, type: def.type } },
      update: {},
      create: {
        mantenedoraId: MANTENEDORA_ID,
        name: def.name,
        level: def.level,
        type: def.type,
        isActive: true,
        isCustom: false,
      },
    });
    roles[def.type] = role;
  }
  console.log('✅', roleDefs.length, 'papéis criados');

  // ── 7. Um usuário de login por papel ──────────────────────────────────
  type UserDef = {
    email: string;
    firstName: string;
    roleType: RoleType;
    unitId?: string;
    classroomId?: string;
  };
  const userDefs: UserDef[] = [
    { email: 'dev@escolateste.zelare.com.br', firstName: 'Dev', roleType: 'DEVELOPER' },
    { email: 'admingeral@escolateste.zelare.com.br', firstName: 'Admin Geral', roleType: 'MANTENEDORA_ADMIN' },
    { email: 'coordenacaocentral@escolateste.zelare.com.br', firstName: 'Coord. Central', roleType: 'STAFF_CENTRAL_PEDAGOGICO' },
    { email: 'psicologia@escolateste.zelare.com.br', firstName: 'Psicóloga', roleType: 'STAFF_CENTRAL_PSICOLOGIA' },
    { email: 'diretora@escolateste.zelare.com.br', firstName: 'Diretora', roleType: 'UNIDADE_DIRETOR', unitId: UNIT_ID },
    { email: 'coordenacao@escolateste.zelare.com.br', firstName: 'Coordenadora', roleType: 'UNIDADE_COORDENADOR_PEDAGOGICO', unitId: UNIT_ID },
    { email: 'secretaria@escolateste.zelare.com.br', firstName: 'Secretaria', roleType: 'UNIDADE_ADMINISTRATIVO', unitId: UNIT_ID },
    { email: 'professor.bercario@escolateste.zelare.com.br', firstName: 'Professor Berçário', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: CLASSROOM_BERCARIO_ID },
    { email: 'professor.bempequena@escolateste.zelare.com.br', firstName: 'Professor Bem Pequenas', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: CLASSROOM_BEM_PEQUENA_ID },
    { email: 'professor.pequena@escolateste.zelare.com.br', firstName: 'Professor Pequenas', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: CLASSROOM_PEQUENA_ID },
  ];

  for (const def of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        mantenedoraId: MANTENEDORA_ID,
        unitId: def.unitId,
        email: def.email,
        password: passwordHash,
        firstName: def.firstName,
        lastName: 'Zelare Teste',
        status: UserStatus.ATIVO,
        emailVerified: true,
      },
    });

    const role = roles[def.roleType];
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id, scopeLevel: roleDefs.find((r) => r.type === def.roleType)!.level },
    });

    if (def.classroomId) {
      await prisma.classroomTeacher.upsert({
        where: { classroomId_teacherId: { classroomId: def.classroomId, teacherId: user.id } },
        update: {},
        create: { classroomId: def.classroomId, teacherId: user.id, role: 'MAIN', isActive: true },
      });
    }
  }
  console.log('✅', userDefs.length, 'usuários de login criados (1 por papel)');

  // ── 8. Um framework pedagógico inicial (motor plugável da Fase 1) ─────
  // Estrutura mínima de exemplo — não é a BNCC completa (isso é um próximo
  // passo separado: importar a matriz oficial via curriculum-import, ou
  // popular a biblioteca global com mais frameworks internacionais).
  const framework = await prisma.pedagogicalFramework.upsert({
    where: { id: FRAMEWORK_ID },
    update: {},
    create: {
      id: FRAMEWORK_ID,
      mantenedoraId: MANTENEDORA_ID,
      name: 'Framework Inicial — Escola Teste',
      country: 'BR',
      isOfficial: false,
      version: 1,
      description: 'Framework de exemplo para validar o motor plugável. Substitua pela BNCC ou pelo currículo próprio da instituição.',
      dimensions: {
        create: [
          {
            code: 'EO',
            name: 'Eu, o Outro e o Nós',
            order: 1,
            objectives: {
              create: [
                { code: 'DEMO-EO-01', ageRangeMin: 0, ageRangeMax: 18, text: 'Interagir com adultos e outras crianças, adaptando-se ao convívio em grupo.' },
              ],
            },
          },
          {
            code: 'CG',
            name: 'Corpo, Gestos e Movimentos',
            order: 2,
            objectives: {
              create: [
                { code: 'DEMO-CG-01', ageRangeMin: 19, ageRangeMax: 47, text: 'Explorar formas de deslocamento no espaço, experimentando o equilíbrio corporal.' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('✅ Framework pedagógico inicial:', framework.name);

  console.log('\n🎉 Instituição teste do Zelare criada com sucesso!\n');
  console.log('📋 LOGINS (senha para todos: ' + SENHA_PADRAO + ')');
  userDefs.forEach((u) => console.log('   -', u.email));
  console.log('\n📦 IDs para referência:');
  console.log('   mantenedoraId:', MANTENEDORA_ID);
  console.log('   unitId:', UNIT_ID);
  console.log('   frameworkId:', FRAMEWORK_ID);
  console.log('\n🔑 Login: POST /auth/login com email + senha acima\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
