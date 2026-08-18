import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Cenário demonstrativo isolado do Zelare.
 *
 * Regras de segurança:
 * - Todos os IDs, códigos, e-mails e nomes são fictícios e têm prefixo demo.
 * - Não grava CID, laudo, diagnóstico, medicação ou notas clínicas.
 * - É idempotente: pode ser executado mais de uma vez.
 * - `--reset-demo` remove somente registros pertencentes a este cenário.
 * - Não use este script para dados de produção ou crianças reais.
 */

const prisma = new PrismaClient();

const PREFIX = 'demo-zelare-2026';
const MANTENEDORA_ID = `${PREFIX}-mantenedora`;
const UNIT_ID = `${PREFIX}-unidade`;
const MATRIX_ID = `${PREFIX}-matriz-2026`;
const PASSWORD = 'Demo@2026';

const CLASSROOMS = [
  { id: `${PREFIX}-classroom-bercario`, name: 'Berçário Demonstrativo', code: 'DEMO-EI01', min: 0, max: 24, capacity: 10 },
  { id: `${PREFIX}-classroom-maternal`, name: 'Maternal Demonstrativo', code: 'DEMO-EI02', min: 24, max: 48, capacity: 12 },
] as const;

const USERS = [
  { id: `${PREFIX}-user-professor-1`, email: 'demo.professor1@zelare.com.br', firstName: 'Paula', lastName: 'Demonstração', role: 'PROFESSOR', level: 'PROFESSOR', classroomId: CLASSROOMS[0].id },
  { id: `${PREFIX}-user-professor-2`, email: 'demo.professor2@zelare.com.br', firstName: 'Rafael', lastName: 'Demonstração', role: 'PROFESSOR', level: 'PROFESSOR', classroomId: CLASSROOMS[1].id },
  { id: `${PREFIX}-user-coordenacao`, email: 'demo.coordenacao@zelare.com.br', firstName: 'Camila', lastName: 'Coordenação', role: 'UNIDADE_COORDENADOR_PEDAGOGICO', level: 'UNIDADE' },
  { id: `${PREFIX}-user-direcao`, email: 'demo.direcao@zelare.com.br', firstName: 'Marcos', lastName: 'Direção', role: 'UNIDADE_DIRETOR', level: 'UNIDADE' },
  { id: `${PREFIX}-user-psicologia`, email: 'demo.psicologia@zelare.com.br', firstName: 'Lia', lastName: 'Psicologia', role: 'STAFF_CENTRAL_PSICOLOGIA', level: 'STAFF_CENTRAL' },
  { id: `${PREFIX}-user-mantenedora`, email: 'demo.mantenedora@zelare.com.br', firstName: 'Joana', lastName: 'Mantenedora', role: 'MANTENEDORA_ADMIN', level: 'MANTENEDORA' },
] as const;

const CHILDREN = [
  { id: `${PREFIX}-child-001`, code: 'DEMO-001', firstName: 'Ayla', lastName: 'Luz', classroomId: CLASSROOMS[0].id, profile: 'progress' },
  { id: `${PREFIX}-child-002`, code: 'DEMO-002', firstName: 'Theo', lastName: 'Mar', classroomId: CLASSROOMS[0].id, profile: 'attention' },
  { id: `${PREFIX}-child-003`, code: 'DEMO-003', firstName: 'Nina', lastName: 'Sol', classroomId: CLASSROOMS[0].id, profile: 'social' },
  { id: `${PREFIX}-child-004`, code: 'DEMO-004', firstName: 'Caio', lastName: 'Rio', classroomId: CLASSROOMS[0].id, profile: 'stable' },
  { id: `${PREFIX}-child-005`, code: 'DEMO-005', firstName: 'Luna', lastName: 'Flor', classroomId: CLASSROOMS[1].id, profile: 'language' },
  { id: `${PREFIX}-child-006`, code: 'DEMO-006', firstName: 'Davi', lastName: 'Céu', classroomId: CLASSROOMS[1].id, profile: 'attention' },
  { id: `${PREFIX}-child-007`, code: 'DEMO-007', firstName: 'Maya', lastName: 'Chuva', classroomId: CLASSROOMS[1].id, profile: 'motor' },
  { id: `${PREFIX}-child-008`, code: 'DEMO-008', firstName: 'Noah', lastName: 'Vento', classroomId: CLASSROOMS[1].id, profile: 'stable' },
] as const;

const DOMAINS = [
  { id: 'COMUNICACAO', label: 'Comunicação e linguagem', context: 'RODA', objective: 'Ampliar a comunicação em situações de interação.' },
  { id: 'INTERACAO', label: 'Interação e convivência', context: 'BRINCADEIRA', objective: 'Participar de interações e combinados do grupo.' },
  { id: 'AUTONOMIA', label: 'Autonomia e participação', context: 'TRANSICAO', objective: 'Realizar etapas da rotina com apoio proporcional.' },
  { id: 'MOVIMENTO', label: 'Corpo e movimento', context: 'ATIVIDADE_DIRIGIDA', objective: 'Explorar movimentos amplos e coordenação.' },
] as const;

const CURRICULUM_ENTRIES = DOMAINS.map((domain, index) => ({
  id: `${PREFIX}-matrix-entry-${index + 1}`,
  date: new Date(Date.UTC(2026, 1, 2 + index * 7)),
  domain,
}));

const profileByChild: Record<string, { level: string; support: string; response: string; concern: boolean; behavior: string }> = {
  progress: { level: 'EM_DESENVOLVIMENTO', support: 'MODELAGEM', response: 'RESPONDEU_BEM', concern: false, behavior: 'Participou com apoio gradual e ampliou a iniciativa ao longo das semanas.' },
  attention: { level: 'REQUER_ATENCAO', support: 'AVISO_VISUAL', response: 'RESPONDEU_PARCIALMENTE', concern: true, behavior: 'Alternou períodos de participação e necessidade de redirecionamento, especialmente em transições.' },
  social: { level: 'ALCANCADO', support: 'MEDIACAO_ADULTO', response: 'RESPONDEU_BEM', concern: false, behavior: 'Buscou pares e respondeu positivamente à mediação de turnos e combinados.' },
  stable: { level: 'ALCANCADO', support: 'NENHUM', response: 'RESPONDEU_BEM', concern: false, behavior: 'Participou das propostas e concluiu as etapas observadas com autonomia compatível.' },
  language: { level: 'EM_DESENVOLVIMENTO', support: 'MODELAGEM', response: 'RESPONDEU_BEM', concern: false, behavior: 'Ampliou vocabulário e passou a comunicar escolhas com mais clareza.' },
  motor: { level: 'EM_DESENVOLVIMENTO', support: 'PAUSA', response: 'RESPONDEU_PARCIALMENTE', concern: true, behavior: 'Explorou o circuito motor com pausas e apoio para organizar a sequência.' },
};

function idFor(kind: string, index: number): string {
  return `${PREFIX}-${kind}-${String(index).padStart(4, '0')}`;
}

function utcDate(daysAgo: number, hour = 13): Date {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function cpfFake(index: number): string {
  return `900.${String(index).padStart(3, '0')}.000-00`;
}

async function resetDemo(): Promise<void> {
  const alertIds = (await prisma.alertaOperacional.findMany({ where: { id: { startsWith: PREFIX } }, select: { id: true } })).map((item) => item.id);
  if (alertIds.length) await prisma.notificacao.deleteMany({ where: { alertaId: { in: alertIds } } });
  await prisma.alertaOperacional.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.developmentObservation.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.diaryEvent.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.planning.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.curriculumMatrixEntry.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.curriculumMatrix.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.enrollment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.classroomTeacher.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.userRole.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.child.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.classroom.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.tenantFeatureFlag.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.tenantBranding.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.role.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.unit.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.mantenedora.deleteMany({ where: { id: MANTENEDORA_ID } });
  console.log('Demo removida somente pelo prefixo', PREFIX);
}

async function main(): Promise<void> {
  if (process.argv.includes('--reset-demo')) {
    await resetDemo();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  await prisma.mantenedora.upsert({
    where: { id: MANTENEDORA_ID },
    update: { name: 'Zelare — Laboratório Demonstrativo', isActive: true, plan: 'professional' },
    create: {
      id: MANTENEDORA_ID,
      name: 'Zelare — Laboratório Demonstrativo',
      email: 'demo.mantenedora@zelare.com.br',
      phone: '0000000000',
      country: 'BR',
      taxIdType: 'NONE',
      city: 'Cidade Demonstrativa',
      state: 'DF',
      isActive: true,
      plan: 'professional',
      maxUnits: 3,
      maxUsers: 30,
    },
  });

  await prisma.tenantBranding.upsert({
    where: { mantenedoraId: MANTENEDORA_ID },
    update: { displayName: 'Zelare — Demonstração Integrada', slogan: 'Ambiente demonstrativo com dados fictícios' },
    create: {
      id: `${PREFIX}-branding`,
      mantenedoraId: MANTENEDORA_ID,
      displayName: 'Zelare — Demonstração Integrada',
      slogan: 'Ambiente demonstrativo com dados fictícios',
      primaryColor: '#243B53',
      secondaryColor: '#0F766E',
    },
  });

  for (const flagKey of ['ia_assistiva', 'portal_familia', 'modo_offline', 'modulo_compras', 'modulo_estoque']) {
    await prisma.tenantFeatureFlag.upsert({
      where: { mantenedoraId_flagKey: { mantenedoraId: MANTENEDORA_ID, flagKey } },
      update: { enabled: true },
      create: { id: `${PREFIX}-flag-${flagKey}`, mantenedoraId: MANTENEDORA_ID, flagKey, enabled: true },
    });
  }

  await prisma.unit.upsert({
    where: { id: UNIT_ID },
    update: { name: 'Unidade Demonstrativa Integrada', isActive: true },
    create: {
      id: UNIT_ID,
      mantenedoraId: MANTENEDORA_ID,
      name: 'Unidade Demonstrativa Integrada',
      code: 'DEMO-01',
      address: 'Endereço fictício de demonstração',
      city: 'Cidade Demonstrativa',
      state: 'DF',
      zipCode: '00000-000',
      email: 'demo.unidade@zelare.com.br',
      phone: '0000000000',
      capacity: 30,
      ageGroupsServed: '0-6',
      isActive: true,
    },
  });

  const roleIds: Record<string, string> = {};
  for (const userDef of USERS) {
    const roleId = `${PREFIX}-role-${userDef.role.toLowerCase()}`;
    roleIds[userDef.role] = roleId;
    await prisma.role.upsert({
      where: { id: roleId },
      update: { isActive: true },
      create: {
        id: roleId,
        mantenedoraId: MANTENEDORA_ID,
        name: `Demonstração — ${userDef.role}`,
        level: userDef.level as any,
        type: userDef.role as any,
        isActive: true,
        isCustom: false,
      },
    });
  }

  const userIds: Record<string, string> = {};
  for (const [index, userDef] of USERS.entries()) {
    const userId = userDef.id;
    userIds[userDef.role] = userId;
    await prisma.user.upsert({
      where: { id: userId },
      update: { password: passwordHash, status: 'ATIVO', emailVerified: true, unitId: UNIT_ID },
      create: {
        id: userId,
        mantenedoraId: MANTENEDORA_ID,
        unitId: UNIT_ID,
        email: userDef.email,
        password: passwordHash,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        cpf: cpfFake(index + 1),
        phone: '0000000000',
        status: 'ATIVO',
        emailVerified: true,
      },
    });
    const userRoleId = `${PREFIX}-user-role-${index + 1}`;
    await prisma.userRole.upsert({
      where: { id: userRoleId },
      update: { isActive: true, scopeLevel: userDef.level as any },
      create: { id: userRoleId, userId, roleId: roleIds[userDef.role], scopeLevel: userDef.level as any, isActive: true },
    });
  }

  for (const classroom of CLASSROOMS) {
    await prisma.classroom.upsert({
      where: { id: classroom.id },
      update: { name: classroom.name, isActive: true },
      create: { id: classroom.id, unitId: UNIT_ID, name: classroom.name, code: classroom.code, ageGroupMin: classroom.min, ageGroupMax: classroom.max, capacity: classroom.capacity, isActive: true },
    });
  }

  for (const userDef of USERS) {
    if (!('classroomId' in userDef)) continue;
    await prisma.classroomTeacher.upsert({
      where: { id: `${PREFIX}-teacher-${userDef.classroomId}` },
      update: { isActive: true },
      create: { id: `${PREFIX}-teacher-${userDef.classroomId}`, classroomId: userDef.classroomId, teacherId: userDef.id, role: 'MAIN' as any, isActive: true },
    });
  }

  for (const [index, childDef] of CHILDREN.entries()) {
    await prisma.child.upsert({
      where: { id: childDef.id },
      update: { isActive: true, firstName: childDef.firstName, lastName: childDef.lastName },
      create: {
        id: childDef.id,
        mantenedoraId: MANTENEDORA_ID,
        unitId: UNIT_ID,
        firstName: childDef.firstName,
        lastName: childDef.lastName,
        dateOfBirth: new Date(Date.UTC(2021, index % 8, 5 + index)),
        gender: index % 2 === 0 ? 'FEMININO' : 'MASCULINO',
        cpf: cpfFake(100 + index),
        emergencyContactName: 'Responsável fictício da demonstração',
        emergencyContactPhone: '0000000000',
        codigoAluno: childDef.code,
        inscricao: childDef.code,
        isActive: true,
      },
    });
    await prisma.enrollment.upsert({
      where: { id: `${PREFIX}-enrollment-${index + 1}` },
      update: { status: 'ATIVA' as any },
      create: { id: `${PREFIX}-enrollment-${index + 1}`, childId: childDef.id, classroomId: childDef.classroomId, enrollmentDate: new Date(Date.UTC(2026, 0, 12)), status: 'ATIVA' as any },
    });
  }

  await prisma.curriculumMatrix.upsert({
    where: { id: MATRIX_ID },
    update: { name: 'Matriz demonstrativa de experiências', isActive: true },
    create: { id: MATRIX_ID, mantenedoraId: MANTENEDORA_ID, name: 'Matriz demonstrativa de experiências', year: 2026, segment: 'EI01', version: 1, description: 'Matriz fictícia para demonstração de cruzamento entre planejamento e coleta.', isActive: true },
  });

  for (const entry of CURRICULUM_ENTRIES) {
    await prisma.curriculumMatrixEntry.upsert({
      where: { id: entry.id },
      update: { objetivoBNCC: entry.domain.objective },
      create: {
        id: entry.id,
        matrixId: MATRIX_ID,
        date: entry.date,
        weekOfYear: 5 + CURRICULUM_ENTRIES.indexOf(entry),
        dayOfWeek: 1,
        bimester: 1,
        campoDeExperiencia: ['ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO', 'O_EU_O_OUTRO_E_O_NOS', 'CORPO_GESTOS_E_MOVIMENTOS', 'TRACOS_SONS_CORES_E_FORMAS'][CURRICULUM_ENTRIES.indexOf(entry)] as any,
        objetivoBNCC: entry.domain.objective,
        objetivoBNCCCode: `DEMO-${entry.domain.id}`,
        intencionalidade: 'Observar participação, estratégias e respostas da criança em contexto cotidiano.',
        exemploAtividade: `Proposta demonstrativa de ${entry.domain.label.toLowerCase()}.`,
      },
    });
  }

  const plans: Array<{ id: string; classroomId: string; professorId: string; entryId: string; date: Date }> = [];
  for (const [classIndex, classroom] of CLASSROOMS.entries()) {
    const professorId = classIndex === 0 ? USERS[0].id : USERS[1].id;
    for (let week = 0; week < 12; week += 1) {
      const entry = CURRICULUM_ENTRIES[week % CURRICULUM_ENTRIES.length];
      const startDate = utcDate(7 * (week + 1), 12);
      const endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 4);
      const planId = `${PREFIX}-planning-${classIndex + 1}-${week + 1}`;
      plans.push({ id: planId, classroomId: classroom.id, professorId, entryId: entry.id, date: startDate });
      await prisma.planning.upsert({
        where: { id: planId },
        update: { status: 'PUBLICADO' as any, title: `Semana ${week + 1} — ${entry.domain.label}` },
        create: {
          id: planId,
          mantenedoraId: MANTENEDORA_ID,
          unitId: UNIT_ID,
          classroomId: classroom.id,
          curriculumMatrixId: MATRIX_ID,
          title: `Semana ${week + 1} — ${entry.domain.label}`,
          description: 'Planejamento fictício do cenário demonstrativo.',
          type: 'SEMANAL' as any,
          startDate,
          endDate,
          objectives: entry.domain.objective,
          activities: [{ title: `Vivência de ${entry.domain.label}`, durationMinutes: 25 }],
          resources: ['materiais da sala', 'espaço de interação'],
          evaluation: 'Registrar evidências observáveis e resposta ao suporte oferecido.',
          bnccAreas: [entry.domain.id],
          curriculumAlignment: 'Cenário demonstrativo — não normativo.',
          pedagogicalContent: { domain: entry.domain.id, source: 'demo-seed', version: 1 },
          observacoesTemplate: [{ id: entry.domain.id, label: entry.domain.label, group: 'Demonstração' }],
          status: 'PUBLICADO' as any,
          anoLetivo: 2026,
          professorId,
          createdBy: professorId,
          publishedAt: endDate,
        },
      });
    }
  }

  let eventCount = 0;
  for (const [childIndex, child] of CHILDREN.entries()) {
    const profile = profileByChild[child.profile];
    const classroomIndex = CLASSROOMS.findIndex((item) => item.id === child.classroomId);
    const professorId = classroomIndex === 0 ? USERS[0].id : USERS[1].id;
    const childPlans = plans.filter((plan) => plan.classroomId === child.classroomId);
    for (let week = 0; week < 12; week += 1) {
      const domain = DOMAINS[(childIndex + week) % DOMAINS.length];
      const plan = childPlans[week];
      const eventDate = utcDate(7 * (week + 1) + (childIndex % 3), 13);
      const envelope = {
        source: 'daily-collection',
        schemaVersion: 2,
        context: domain.context,
        opportunity: week % 5 === 0 && profile.concern ? 'RECUSA' : 'OBSERVADA',
        domain: domain.id,
        indicatorId: `demo-${domain.id.toLowerCase()}`,
        level: profile.level,
        support: profile.support,
        response: profile.response,
        durationSeconds: 120 + (childIndex % 4) * 60,
        frequency: profile.concern ? 2 + (week % 3) : 1,
        objectiveNote: domain.objective,
        teacherConcern: profile.concern && week >= 6,
        recordedAt: eventDate.toISOString(),
        ...(profile.concern && week % 3 === 0 ? { abc: { antecedent: 'Mudança de atividade ou espera por turno', behavior: profile.behavior, consequence: 'Mediação e retomada gradual da proposta', intensity: 2 + (week % 3), frequency: 1 + (week % 2) } } : {}),
      };
      const eventId = idFor('diary-event', eventCount + 1);
      await prisma.diaryEvent.upsert({
        where: { id: eventId },
        update: { eventDate, aiContext: envelope as any, status: 'PUBLICADO' as any },
        create: {
          id: eventId,
          mantenedoraId: MANTENEDORA_ID,
          unitId: UNIT_ID,
          classroomId: child.classroomId,
          childId: child.id,
          planningId: plan.id,
          curriculumEntryId: plan.entryId,
          type: 'DESENVOLVIMENTO' as any,
          title: `Demonstração — ${domain.label}`,
          description: profile.behavior,
          eventDate,
          observations: profile.behavior,
          developmentNotes: `Evidência estruturada no domínio ${domain.label}.`,
          behaviorNotes: profile.concern ? 'Registro observável para acompanhamento pedagógico.' : null,
          tags: ['demo-seed-2026', 'coleta_estruturada', domain.id.toLowerCase()],
          aiContext: envelope as any,
          retroactiveEdit: true,
          retroactiveNote: 'Evento histórico fictício criado para demonstração controlada.',
          status: 'PUBLICADO' as any,
          createdAt: eventDate,
          updatedAt: eventDate,
          createdBy: professorId,
          publishedAt: eventDate,
        },
      });
      eventCount += 1;
    }
  }

  let observationCount = 0;
  for (const [childIndex, child] of CHILDREN.entries()) {
    const profile = profileByChild[child.profile];
    for (let period = 0; period < 3; period += 1) {
      const observationId = idFor('development-observation', observationCount + 1);
      const date = utcDate(28 * (period + 1) + childIndex, 14);
      await prisma.developmentObservation.upsert({
        where: { id: observationId },
        update: { date, category: 'DEMO_ACOMPANHAMENTO' },
        create: {
          id: observationId,
          childId: child.id,
          classroomId: child.classroomId,
          createdBy: child.classroomId === CLASSROOMS[0].id ? USERS[0].id : USERS[1].id,
          category: 'DEMO_ACOMPANHAMENTO',
          date,
          behaviorDescription: profile.behavior,
          socialInteraction: child.profile === 'social' ? 'Buscou pares e compartilhou materiais com mediação leve.' : 'Interagiu conforme o contexto e respondeu aos convites do adulto.',
          emotionalState: 'Registro educacional descritivo; não constitui avaliação clínica.',
          motorSkills: child.profile === 'motor' ? 'Explorou movimentos com pausas e apoio.' : 'Participou de experiências corporais propostas.',
          cognitiveSkills: 'Identificou relações simples na proposta e retomou estratégias com apoio.',
          languageSkills: child.profile === 'language' ? 'Ampliou formas de comunicar escolhas e narrativas.' : 'Comunicou interesses e respostas no contexto observado.',
          learningProgress: period === 2 ? 'Apresentou evolução em comparação ao primeiro período do cenário.' : 'Evidências em acompanhamento longitudinal.',
          planningParticipation: 'Participação registrada em atividades planejadas e momentos de rotina.',
          interests: 'Brincadeiras, histórias, música e exploração de materiais.',
          challenges: profile.concern ? 'Necessita observação continuada em transições e espera por turnos.' : 'Nenhum ponto de atenção prioritário no período demonstrativo.',
          recommendations: 'Manter propostas acessíveis, observar contexto e registrar resposta ao suporte.',
          nextSteps: 'Revisar evidências na reunião pedagógica e ajustar estratégias quando necessário.',
          tags: ['demo-seed-2026', 'nao-clinico'],
          indicadores: { source: 'demo-seed-2026', level: profile.level, concern: profile.concern, period: period + 1 },
          createdAt: date,
          updatedAt: date,
        },
      });
      observationCount += 1;
    }
  }

  const alertChildren = CHILDREN.filter((child) => profileByChild[child.profile].concern);
  for (const [index, child] of alertChildren.entries()) {
    const profile = profileByChild[child.profile];
    const alertId = idFor('alert', index + 1);
    await prisma.alertaOperacional.upsert({
      where: { id: alertId },
      update: { resolvido: false, descricao: `Sinal observacional recorrente em registros fictícios da demonstração: ${profile.behavior}` },
      create: {
        id: alertId,
        mantenedoraId: MANTENEDORA_ID,
        unitId: UNIT_ID,
        classroomId: child.classroomId,
        childId: child.id,
        tipo: 'OUTRO' as any,
        severidade: index === 0 ? 'ALTA' as any : 'MEDIA' as any,
        titulo: `Acompanhamento pedagógico — ${child.firstName}`,
        descricao: `Sinal observacional recorrente em registros fictícios da demonstração: ${profile.behavior}`,
        metadados: { source: 'demo-seed-2026', rule: 'recorrencia_contexto_suporte', diagnostic: false, requiresHumanReview: true, windowDays: 84 },
        resolvido: false,
        criadoEm: now,
      },
    });
    for (const recipient of [USERS[2], USERS[3], USERS[4]]) {
      await prisma.notificacao.create({
        data: {
          id: `${alertId}-${recipient.id}`,
          usuarioId: recipient.id,
          alertaId: alertId,
          titulo: `Novo acompanhamento pedagógico — ${child.firstName}`,
          mensagem: 'Há evidências fictícias recorrentes para revisão humana. O sinal não é diagnóstico nem laudo.',
          lida: false,
        },
      }).catch(() => undefined);
    }
  }

  console.log(JSON.stringify({
    demo: PREFIX,
    mantenedoraId: MANTENEDORA_ID,
    unitId: UNIT_ID,
    classrooms: CLASSROOMS.length,
    users: USERS.length,
    children: CHILDREN.length,
    plans: plans.length,
    diaryEvents: eventCount,
    developmentObservations: observationCount,
    alerts: alertChildren.length,
    credentials: { password: PASSWORD, emails: USERS.map((user) => user.email) },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
