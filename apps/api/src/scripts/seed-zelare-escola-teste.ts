import { PrismaClient, RoleLevel, RoleType, UserStatus, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed de uma instituição teste COMPLETA do Zelare — escola, 4 turmas, 11 papéis
 * de acesso com login simplificado (nome@zelare.com.br), e 16 crianças fictícias
 * com dados no mesmo nível de completude do sistema real: endereço, tipagem
 * sanguínea, dados dos responsáveis (mãe/pai/responsável legal), pessoas
 * autorizadas a retirar, e uma amostra realista de dados de saúde (alergia,
 * condição médica, laudo). Tudo fictício — nenhum dado de criança ou
 * funcionário real foi usado, mesmo tendo como referência a estrutura de uma
 * planilha real (mesmo formato que apps/api/src/scripts/import-dados-responsaveis.ts
 * já usa em produção).
 *
 *   cd apps/api && npx ts-node src/scripts/seed-zelare-escola-teste.ts
 */

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function cpfFicticio(seq: number): string {
  const base = String(900000000 + seq).padStart(9, '0');
  const dv = String(90 + (seq % 9)).padStart(2, '0');
  return `${base.slice(0, 3)}.${base.slice(3, 6)}.${base.slice(6, 9)}-${dv}`;
}
function rgFicticio(seq: number): string {
  return String(2000000 + seq * 37);
}
function celFicticio(seq: number): string {
  return `61 9${String(80000000 + seq * 7).padStart(8, '0')}`;
}
function foneFicticio(seq: number): string {
  return `61 9${String(80000000 + seq).padStart(8, '0')}`;
}
function cepFicticio(seq: number): string {
  return `72.6${String(seq % 90).padStart(2, '0')}-${String((seq * 37) % 900).padStart(3, '0')}`;
}
function enderecoFicticio(seq: number): string {
  const quadra = (seq % 30) + 1;
  const bloco = String.fromCharCode(65 + (seq % 6));
  const casa = (seq % 20) + 1;
  return `QN ${quadra} / Bloco ${bloco} / Casa ${casa}`;
}

const SOBRENOMES = [
  'Souza Lima', 'Oliveira Santos', 'Costa Ferreira', 'Almeida Rocha', 'Pereira Gomes',
  'Rodrigues Dias', 'Carvalho Nunes', 'Barbosa Teixeira', 'Ribeiro Cardoso', 'Martins Duarte',
  'Araújo Correia', 'Nascimento Vieira', 'Moura Batista', 'Freitas Cunha', 'Azevedo Pinto', 'Monteiro Braga',
];
const NOMES_F = ['Helena', 'Alice', 'Laura', 'Valentina', 'Sophia', 'Isabela', 'Manuela', 'Liz', 'Cecília', 'Beatriz', 'Antonella', 'Lorena', 'Elisa', 'Mariana', 'Clara', 'Isadora'];
const NOMES_M = ['Miguel', 'Arthur', 'Heitor', 'Théo', 'Davi', 'Gael', 'Noah', 'Bernardo', 'Samuel', 'Pedro', 'Enzo', 'Benício', 'Anthony', 'Ravi', 'Matteo', 'Vicente'];
const NOMES_MAE = ['Fernanda', 'Juliana', 'Camila', 'Patrícia', 'Renata', 'Larissa', 'Aline', 'Débora', 'Vanessa', 'Priscila', 'Tatiane', 'Adriana', 'Michele', 'Bruna', 'Kelly', 'Rosana'];
const NOMES_PAI = ['Marcos', 'Rodrigo', 'Fábio', 'André', 'Diego', 'Leandro', 'Thiago', 'Bruno', 'Fernando', 'Sérgio', 'Vinícius', 'Wesley', 'Anderson', 'Cleber', 'Elias', 'Renan'];
const TIPAGENS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RACAS = ['Parda', 'Branca', 'Preta', 'Amarela', 'Indígena'];
const ESCOLARIDADES = ['Médio', 'Superior', 'Superior Completo', 'Fundamental', 'Médio Completo'];
const PROFISSOES = ['Vendedora', 'Autônomo', 'Auxiliar Administrativo', 'Motorista', 'Cuidadora', 'Recepcionista', 'Técnico em Enfermagem', 'Comerciante'];

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
      id: MANTENEDORA_ID, name: 'Escola Teste Zelare', email: 'contato@escolateste.zelare.com.br',
      phone: '1199990000', country: 'BR', taxIdType: 'NONE', city: 'São Paulo', state: 'SP',
      isActive: true, plan: 'professional', maxUnits: 5, maxUsers: 100,
    },
  });
  console.log('✅ Mantenedora:', mantenedora.name);

  await prisma.tenantBranding.upsert({
    where: { mantenedoraId: MANTENEDORA_ID },
    update: {},
    create: { mantenedoraId: MANTENEDORA_ID, displayName: 'Escola Teste Zelare', slogan: 'Ambiente de testes — dados fictícios', primaryColor: '#1E3A8A', secondaryColor: '#0F6E56' },
  });
  for (const flagKey of ['ia_assistiva', 'upload_conteudo_proprio', 'multiplos_frameworks_pedagogicos', 'modulo_estoque', 'modulo_compras', 'portal_familia', 'modo_offline']) {
    await prisma.tenantFeatureFlag.upsert({
      where: { mantenedoraId_flagKey: { mantenedoraId: MANTENEDORA_ID, flagKey } },
      update: { enabled: true },
      create: { mantenedoraId: MANTENEDORA_ID, flagKey, enabled: true },
    });
  }

  const unit = await prisma.unit.upsert({
    where: { id: UNIT_ID },
    update: {},
    create: {
      id: UNIT_ID, mantenedoraId: MANTENEDORA_ID, name: 'Unidade Piloto', code: 'PILOTO-01',
      address: 'Rua de Teste, 100', city: 'São Paulo', state: 'SP', zipCode: '01000-000',
      phone: '1198880000', email: 'piloto@escolateste.zelare.com.br', isActive: true,
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
      where: { id: t.id }, update: {},
      create: { id: t.id, unitId: UNIT_ID, name: t.name, code: t.code, ageGroupMin: t.min, ageGroupMax: t.max, capacity: t.capacity, isActive: true },
    });
  }
  console.log('✅', turmasDef.length, 'turmas criadas');

  // ── Papéis (11 tipos, cobertura total) ──────────────────────────────────
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
      create: { mantenedoraId: MANTENEDORA_ID, name: def.name, level: def.level, type: def.type, isActive: true, isCustom: false },
    });
    roles[def.type] = role;
  }
  console.log('✅', roleDefs.length, 'papéis criados');

  // ── Usuários — login SIMPLES: primeironome@zelare.com.br ───────────────
  type UserDef = { firstName: string; lastName: string; roleType: RoleType; unitId?: string; classroomId?: string; classroomRole?: 'MAIN' | 'AUXILIARY' };
  const userDefs: UserDef[] = [
    { firstName: 'Lucas', lastName: 'Andrade', roleType: 'DEVELOPER' },
    { firstName: 'Marina', lastName: 'Ribeiro', roleType: 'MANTENEDORA_ADMIN' },
    { firstName: 'Eduardo', lastName: 'Campos', roleType: 'MANTENEDORA_FINANCEIRO' },
    { firstName: 'Fernanda', lastName: 'Martins', roleType: 'STAFF_CENTRAL_PEDAGOGICO' },
    { firstName: 'Camila', lastName: 'Torres', roleType: 'STAFF_CENTRAL_PSICOLOGIA' },
    { firstName: 'Roberto', lastName: 'Nascimento', roleType: 'UNIDADE_DIRETOR', unitId: UNIT_ID },
    { firstName: 'Juliana', lastName: 'Pereira', roleType: 'UNIDADE_COORDENADOR_PEDAGOGICO', unitId: UNIT_ID },
    { firstName: 'Patricia', lastName: 'Rocha', roleType: 'UNIDADE_ADMINISTRATIVO', unitId: UNIT_ID },
    { firstName: 'Beatriz', lastName: 'Costa', roleType: 'UNIDADE_NUTRICIONISTA', unitId: UNIT_ID },
    { firstName: 'Renata', lastName: 'Barbosa', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-bercario1', classroomRole: 'MAIN' },
    { firstName: 'Tiago', lastName: 'Correia', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-bercario2', classroomRole: 'MAIN' },
    { firstName: 'Larissa', lastName: 'Vieira', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-maternal', classroomRole: 'MAIN' },
    { firstName: 'Gustavo', lastName: 'Dias', roleType: 'PROFESSOR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-preescola', classroomRole: 'MAIN' },
    { firstName: 'Aline', lastName: 'Moreira', roleType: 'PROFESSOR_AUXILIAR', unitId: UNIT_ID, classroomId: 'zelare-teste-classroom-maternal', classroomRole: 'AUXILIARY' },
  ];

  let seq = 1;
  for (const def of userDefs) {
    const email = `${semAcento(def.firstName)}@zelare.com.br`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        mantenedoraId: MANTENEDORA_ID, unitId: def.unitId, email, password: passwordHash,
        firstName: def.firstName, lastName: def.lastName, cpf: cpfFicticio(seq), phone: celFicticio(seq),
        status: UserStatus.ATIVO, emailVerified: true,
      },
    });
    seq++;
    const roleDef = roleDefs.find((r) => r.type === def.roleType)!;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[def.roleType].id } },
      update: {},
      create: { userId: user.id, roleId: roles[def.roleType].id, scopeLevel: roleDef.level },
    });
    if (def.classroomId) {
      await prisma.classroomTeacher.upsert({
        where: { classroomId_teacherId: { classroomId: def.classroomId, teacherId: user.id } },
        update: {},
        create: { classroomId: def.classroomId, teacherId: user.id, role: def.classroomRole ?? 'MAIN', isActive: true },
      });
    }
  }
  console.log('✅', userDefs.length, 'usuários criados — login: primeironome@zelare.com.br, senha:', SENHA_PADRAO);

  // ── Crianças — 4 por turma, dados completos (endereço, tipagem, responsáveis) ──
  const hoje = new Date();
  function dataNascimentoParaIdade(mesesMin: number, mesesMax: number, offset: number): Date {
    const meses = mesesMin + (offset % Math.max(1, mesesMax - mesesMin));
    const d = new Date(hoje);
    d.setMonth(d.getMonth() - meses);
    d.setDate(1 + (offset % 27));
    return d;
  }

  let childSeq = 0;
  let totalCriancas = 0;
  for (const turma of turmasDef) {
    for (let i = 0; i < 4; i++) {
      childSeq++;
      const isMenino = childSeq % 2 === 0;
      const primeiroNome = isMenino ? NOMES_M[childSeq % NOMES_M.length] : NOMES_F[childSeq % NOMES_F.length];
      const sobrenome = SOBRENOMES[childSeq % SOBRENOMES.length];
      const nomeMae = `${NOMES_MAE[childSeq % NOMES_MAE.length]} ${sobrenome}`;
      const nomePai = `${NOMES_PAI[childSeq % NOMES_PAI.length]} ${SOBRENOMES[(childSeq + 3) % SOBRENOMES.length]}`;
      const childId = `zelare-teste-child-${String(childSeq).padStart(3, '0')}`;
      const endereco = enderecoFicticio(childSeq);
      const cep = cepFicticio(childSeq);

      const dadosResponsaveis: Record<string, unknown> = {
        mae: {
          nome: nomeMae, cpf: cpfFicticio(1000 + childSeq), celular: celFicticio(1000 + childSeq),
          telefoneResidencial: foneFicticio(1000 + childSeq), endereco, cep, parentesco: 'MÃE',
        },
        pai: { nome: nomePai, celular: celFicticio(2000 + childSeq), parentesco: 'PAI' },
        responsavelLegal: {
          nome: nomeMae, parentesco: 'MÃE', cpf: cpfFicticio(1000 + childSeq),
          identidade: rgFicticio(childSeq), orgaoExpeditor: 'SSP DF', pis: '',
          telefoneResidencial: foneFicticio(1000 + childSeq), celular: celFicticio(1000 + childSeq),
          escolaridade: ESCOLARIDADES[childSeq % ESCOLARIDADES.length], profissao: PROFISSOES[childSeq % PROFISSOES.length],
        },
        autorizados: [
          { nome: `${NOMES_F[(childSeq + 5) % NOMES_F.length]} ${sobrenome}`, parentesco: 'AVÓ', telefone: celFicticio(3000 + childSeq) },
          { nome: `${NOMES_M[(childSeq + 7) % NOMES_M.length]} ${sobrenome}`, parentesco: 'TIO', telefone: celFicticio(4000 + childSeq) },
        ],
      };

      // Amostra realista de dados de saúde — nem toda criança tem, igual na vida real
      let allergies: string | null = null;
      let medicalConditions: string | null = null;
      let medicationNeeds: string | null = null;
      let laudado = false;
      let tipoLaudo: string | null = null;
      let cid: string | null = null;
      let descricaoLaudo: string | null = null;

      if (childSeq % 6 === 2) {
        allergies = 'Alergia à proteína do leite de vaca (APLV) — dieta com fórmula extensamente hidrolisada';
      }
      if (childSeq % 7 === 3) {
        medicalConditions = 'Asma leve, com crises esporádicas em época de mudança de temperatura';
        medicationNeeds = 'Salbutamol spray, uso apenas em caso de crise, conforme orientação médica anexada ao prontuário';
      }
      if (childSeq % 8 === 5) {
        laudado = true;
        tipoLaudo = 'TEA — Transtorno do Espectro Autista';
        cid = 'F84.0';
        descricaoLaudo = 'Acompanhamento com terapeuta ocupacional 2x/semana. Atenção redobrada a estímulos sensoriais em sala (ruído, luz).';
      }

      await prisma.child.upsert({
        where: { id: childId },
        update: {},
        create: {
          id: childId, mantenedoraId: MANTENEDORA_ID, unitId: UNIT_ID,
          firstName: primeiroNome, lastName: sobrenome,
          dateOfBirth: dataNascimentoParaIdade(turma.min, turma.max, childSeq),
          gender: isMenino ? Gender.MASCULINO : Gender.FEMININO,
          cpf: cpfFicticio(5000 + childSeq), rg: null,
          bloodType: TIPAGENS[childSeq % TIPAGENS.length],
          raca: RACAS[childSeq % RACAS.length],
          peso: `${(6 + (childSeq % 15))},${childSeq % 10} KG`,
          nacionalidade: 'BRASILEIRO (A)', naturalidade: 'BRASÍLIA', ufNascimento: 'DF',
          endereco, cep,
          nomeMae, nomePai, celPai: celFicticio(2000 + childSeq),
          nis: childSeq % 3 === 0 ? `1${String(60000000000 + childSeq).padStart(11, '0')}` : null,
          usoImagem: childSeq % 4 !== 0,
          codigoAluno: `ZEL${String(childSeq).padStart(5, '0')}`,
          inscricao: `${200000 + childSeq}`,
          emergencyContactName: nomeMae, emergencyContactPhone: celFicticio(1000 + childSeq),
          allergies, medicalConditions, medicationNeeds,
          laudado, tipoLaudo, cid, descricaoLaudo,
          dadosResponsaveis: dadosResponsaveis as any,
          isActive: true,
        },
      });

      // Matrícula da criança na turma
      await prisma.enrollment.upsert({
        where: { childId_classroomId: { childId, classroomId: turma.id } },
        update: {},
        create: {
          id: `zelare-teste-enrollment-${String(childSeq).padStart(3, '0')}`,
          childId, classroomId: turma.id,
          status: 'ATIVA', enrollmentDate: new Date(hoje.getFullYear(), 1, 1),
        },
      });

      totalCriancas++;
    }
  }
  console.log('✅', totalCriancas, 'crianças criadas — dados completos (endereço, tipagem sanguínea, responsáveis, autorizados a retirar)');
  console.log('   Amostra de dados de saúde: alergias, condição médica com medicação, e 1 laudo — distribuídos de forma realista, nem toda criança tem');

  // ── Framework pedagógico inicial ────────────────────────────────────────
  const framework = await prisma.pedagogicalFramework.upsert({
    where: { id: FRAMEWORK_ID },
    update: {},
    create: {
      id: FRAMEWORK_ID, mantenedoraId: MANTENEDORA_ID, name: 'Framework Inicial — Escola Teste',
      country: 'BR', isOfficial: false, version: 1,
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
        id: `${FRAMEWORK_ID}-${d.objetivo.code}`, frameworkId: FRAMEWORK_ID, dimensionId: dimensao.id,
        code: d.objetivo.code, ageRangeMin: d.objetivo.ageRangeMin, ageRangeMax: d.objetivo.ageRangeMax, text: d.objetivo.text,
      },
    });
  }
  console.log('✅ Framework pedagógico inicial:', framework.name);

  console.log('\n🎉 Instituição teste COMPLETA do Zelare criada com sucesso!\n');
  console.log('📋 LOGINS (senha para todos: ' + SENHA_PADRAO + ')');
  userDefs.forEach((u) => console.log(`   - ${semAcento(u.firstName)}@zelare.com.br  [${u.roleType}]`));
  console.log('\n📦 IDs para referência:');
  console.log('   mantenedoraId:', MANTENEDORA_ID, '| unitId:', UNIT_ID, '| frameworkId:', FRAMEWORK_ID);
  console.log(`   ${totalCriancas} crianças cadastradas, 4 por turma, com dados completos.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
