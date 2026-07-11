import { PrismaClient, RoleLevel, RoleType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed de uma instituição teste COMPLETA do Zelare — escola, 4 turmas, e um
 * usuário de login pronto para CADA UM dos 11 papéis que o sistema suporta,
 * com dados fictícios completos (nome, CPF, telefone). Idempotente.
 *
 *   cd apps/api && npx ts-node src/scripts/seed-zelare-escola-teste.ts
 */

// Gera um CPF no formato correto mas claramente fictício (sequencial, não é
// dado de pessoa real). Não precisa passar validação de dígito verificador —
// este seed grava direto via Prisma, sem passar pelos DTOs/validators da API.
function cpfFicticio(sequencial: number): string {
  const base = String(900000000 + sequencial).padStart(9, '0');
  const dv = String(90 + (sequencial % 9)).padStart(2, '0');
  return `${base.slice(0, 3)}.${base.slice(3, 6)}.${base.slice(6, 9)}-${dv}`;
}

function telefoneFicticio(sequencial: number): string {
  return `119${String(80000000 + sequencial).padStart(8, '0')}`;
}

async function main() {
  console.log('🌱 Criando instituição teste COMPLETA do Zelare...\n');

  const MANTENEDORA_ID = 'zelare-teste-mantenedora-001';
  const UNIT_ID = 'zelare-teste-unit-001';
  const FRAMEWORK_ID = 'zelare-teste-framework-inicial';

  const SENHA_PADRAO = 'Zelare#2026';
  const passwordHash = await bcrypt.hash(SENHA_PADRAO, 10);

  const mantenedora = await prisma.mantenedora.upsert({
    where: { id: MANTENEDORA_ID },
    update: {},
    create: {
      id: MANTENEDORA_ID,
      name: 'Escola Teste Zelare',
      email: 'contato@escolateste.zelare.com.br',
      phone: '1199990000',
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

  await prisma.tenantBranding.upsert({
    where: { mantenedoraId: MANTENEDORA_ID },
    update: {},
    create: {
      mantenedoraId: MANTENEDORA_ID,
      displayName: 'Escola Teste Zelare',
      slogan: 'Ambiente de testes — dados fictícios',
      primaryColor: '#1E3A8A',
      secondaryColor: '#0F6E56',
    },
  });

  for (const flagKey of [
    'ia_assistiva',
    'upload_conteudo_proprio',
    'multiplos_frameworks_pedagogicos',
    'modulo_estoque',
    'modulo_compras',
    'portal_familia',
    'modo_offline',
  ]) {
    await prisma.tenantFeatureFlag.upsert({
      where: { mantenedoraId_flagKey: { mantenedoraId: MANTENEDORA_ID, flagKey } },
      update: { enabled: true },
      create: { mantenedoraId: MANTENEDORA_ID, flagKey, enabled: true },
    });
  }
  console.log('✅ Branding e feature flags de teste prontos');

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
      phone: '1198880000',
      email: 'piloto@escolateste.zelare.com.br',
      isActive: true,
    },
  });
  console.log('✅ Unidade:', unit.name);

  const turmasDef = [
    { id: 'zelare-teste-classroom-bercario1', name: 'Berçário I', code: 'EI01-A', min: 0, max: 11, capacity: 10 },
    { id: 'zelare-teste-classroom-bercario2', name: 'Berçário II', code: 'EI01-B', min: 12, max: 23, capacity: 12 },
    { id: 'zelare-teste-classroom-maternal', name: 'Maternal', code: 'EI02-A', min: 24, max: 47, capacity: 15 },
    { id: 'zelare-teste-classroom-preescola', name: 'Pré-escola', code: 'EI03-A', min: 48, max: 71, capacity: 20 },
  ];

  for (const t of turmasDef) {
    await prisma.classroom.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        unitId: UNIT_ID,
        name: t.name,
        code: t.code,
        ageGroupMin: t.min,
        ageGroupMax: t.max,
        capacity: t.capacity,
        isActive: true,
      },
    });
  }
  console.log('✅', turmasDef.length, 'turmas criadas:', turmasDef.map((t) => t.name).join(', '));

  const roleDefs: { type: RoleType; level: RoleLevel; name: string }[] = [
    { type: 'DEVELOPER', level: 'DEVELOPER', name: 'Desenvolvedor' },
    { type: 'MANTENEDORA_ADMIN', level: 'MANTENEDORA', name: 'Administração Geral' },
    { type: 'MANTENEDORA_FINANCEIRO', level: 'MANTENEDORA', name: 'Financeiro' },
    { type: 'STAFF_CENTRAL_PEDAGOGICO', level: 'STAFF_CENTRAL', name: 'Coordenação Geral' },
    { type: 'STAFF_CENTRAL_PSICOLOGIA', level: 'STAFF_CENTRAL', name: 'Psicologia' },
    { type: 'UNIDADE_DIRETOR', level: 'UNIDADE', name: 'Direção da Unidade' },
    { type: 'UNIDADE_COORDENADOR_PEDAGOGICO', level: 'UNIDADE', name: 'Coordenação Pedagógica da Unidade' },
    { type: 'UNIDADE_ADMINISTRATIVO', level: 'UNIDADE', name: 'Secretaria' },
    { type: 'UNIDADE_NUTRICIONISTA', level: 'UNIDADE', name: 'Nutrição' },
    { type: 'PROFESSOR', level: 'PROFESSOR', name: 'Professor' },
    { type: 'PROFESSOR_AUXILIAR', level: 'PROFESSOR', name: 'Professor Auxiliar' },
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
  console.log('✅', roleDefs.length, 'papéis criados (cobertura total do RoleType)');

  type UserDef = {
    email: string;
    firstName: string;
    lastName: string;
    roleType: RoleType;
    unitId?: string;
    classroomId?: string;
    classroomRole?: 'MAIN' | 'AUXILIARY';
  };

  const userDefs: UserDef[] = [
    { email: 'dev@escolateste.zelare.com.br', firstName: 'Lucas', lastName: 'Andrade Ferreira', roleType: 'DEVELOPER' },
    { email: 'administrativo@escolateste.zelare.com.br', firstName: 'Marina', lastName: 'Ribeiro Souza', roleType: 'MANTENEDORA_ADMIN' },
    { email: 'financeiro@escolateste.zelare.com.br', firstName: 'Eduardo', lastName: 'Campos Lima', roleType: 'MANTENEDORA_FINANCEIRO' },
    { email: 'coordenacaogeral@escolateste.zelare.com.br', firstName: 'Fernanda', lastName: 'Oliveira Martins', roleType: 'STAFF_CENTRAL_PEDAGOGICO' },
    { email: 'psicologia@escolateste.zelare.com.br', firstName: 'Camila', lastName: 'Torres Almeida', roleType: 'STAFF_CENTRAL_PSICOLOGIA' },
    { email: 'diretor@escolateste.zelare.com.br', firstName: 'Roberto', lastName: 'Carlos Nascimento', roleType: 'UNIDADE_DIRETOR', unitId: UNIT_ID },
    { email: 'coordenadora@escolateste.zelare.com.br', firstName: 'Juliana', lastName: 'Santos Pereira', roleType: 'UNIDADE_COORDENADOR_PEDAGOGICO', unitId: UNIT_ID },
    { email: 'secretaria@escolateste.zelare.com.br', firstName: 'Patrícia', lastName: 'Gomes Rocha', roleType: 'UNIDADE_ADMINISTRATIVO', unitId: UNIT_ID },
    { email: 'nutricionista@escolateste.zelare.com.br', firstName: 'Beatriz', lastName: 'Fernandes Costa', roleType: 'UNIDADE_NUTRICIONISTA', unitId: UNIT_ID },
    { email: 'professor.bercario1@escolateste.zelare.com.br', firstName: 'Renata', lastName: 'Alves Barbosa', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-bercario1', classroomRole: 'MAIN' },
    { email: 'professor.bercario2@escolateste.zelare.com.br', firstName: 'Tiago', lastName: 'Henrique Correia', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-bercario2', classroomRole: 'MAIN' },
    { email: 'professor.maternal@escolateste.zelare.com.br', firstName: 'Larissa', lastName: 'Cardoso Vieira', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-maternal', classroomRole: 'MAIN' },
    { email: 'professor.preescola@escolateste.zelare.com.br', firstName: 'Gustavo', lastName: 'Pinheiro Dias', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-preescola', classroomRole: 'MAIN' },
    { email: 'professor.auxiliar@escolateste.zelare.com.br', firstName: 'Aline', lastName: 'Moreira Castro', roleType: 'PROFESSOR_AUXILIAR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-maternal', classroomRole: 'AUXILIARY' },
  ];

  let seq = 1;
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
        lastName: def.lastName,
        cpf: cpfFicticio(seq),
        phone: telefoneFicticio(seq),
        status: UserStatus.ATIVO,
        emailVerified: true,
      },
    });
    seq++;

    const roleDef = roleDefs.find((r) => r.type === def.roleType)!;
    const role = roles[def.roleType];
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id, scopeLevel: roleDef.level },
    });

    if (def.classroomId) {
      await prisma.classroomTeacher.upsert({
        where: { classroomId_teacherId: { classroomId: def.classroomId, teacherId: user.id } },
        update: {},
        create: {
          classroomId: def.classroomId,
          teacherId: user.id,
          role: def.classroomRole ?? 'MAIN',
          isActive: true,
        },
      });
    }
  }
  console.log('✅', userDefs.length, 'usuários fictícios criados (1 por papel, todos os 11 tipos cobertos)');

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
    },
  });

  const dimensoesDef = [
    { code: 'EO', name: 'Eu, o Outro e o Nós', order: 1, objetivo: { code: 'DEMO-EO-01', ageRangeMin: 0, ageRangeMax: 18, text: 'Interagir com adultos e outras crianças, adaptando-se ao convívio em grupo.' } },
    { code: 'CG', name: 'Corpo, Gestos e Movimentos', order: 2, objetivo: { code: 'DEMO-CG-01', ageRangeMin: 19, ageRangeMax: 47, text: 'Explorar formas de deslocamento no espaço, experimentando o equilíbrio corporal.' } },
    { code: 'TS', name: 'Traços, Sons, Cores e Formas', order: 3, objetivo: { code: 'DEMO-TS-01', ageRangeMin: 48, ageRangeMax: 71, text: 'Expressar-se por meio de diferentes linguagens artísticas, criando produções individuais e coletivas.' } },
  ];

  for (const d of dimensoesDef) {
    const dimensao = await prisma.frameworkDimension.upsert({
      where: { frameworkId_code: { frameworkId: FRAMEWORK_ID, code: d.code } },
      update: {},
      create: { frameworkId: FRAMEWORK_ID, code: d.code, name: d.name, order: d.order },
    });
    await prisma.frameworkObjective.upsert({
      where: { id: `${FRAMEWORK_ID}-${d.objetivo.code}` },
      update: {},
      create: {
        id: `${FRAMEWORK_ID}-${d.objetivo.code}`,
        frameworkId: FRAMEWORK_ID,
        dimensionId: dimensao.id,
        code: d.objetivo.code,
        ageRangeMin: d.objetivo.ageRangeMin,
        ageRangeMax: d.objetivo.ageRangeMax,
        text: d.objetivo.text,
      },
    });
  }
  console.log('✅ Framework pedagógico inicial:', framework.name);

  console.log('\n🎉 Instituição teste COMPLETA do Zelare criada com sucesso!\n');
  console.log('📋 LOGINS (senha para todos: ' + SENHA_PADRAO + ')');
  userDefs.forEach((u) => console.log(`   - ${u.email}  [${u.roleType}]`));
  console.log('\n📦 IDs para referência:');
  console.log('   mantenedoraId:', MANTENEDORA_ID);
  console.log('   unitId:', UNIT_ID);
  console.log('   frameworkId:', FRAMEWORK_ID);
  console.log('   turmas:', turmasDef.map((t) => `${t.name}=${t.id}`).join(' | '));
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
