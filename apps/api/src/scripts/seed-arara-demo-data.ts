import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const UNIT_CODE = 'ARARA-CAN';

async function main() {
  console.log('🚀 Criando dados demo para dashboard do professor (ARARA-CAN)...\n');

  // 1. Buscar unidade ARARA-CAN
  const unit = await prisma.unit.findFirst({
    where: { code: UNIT_CODE },
    include: { mantenedora: true },
  });

  if (!unit) {
    throw new Error(`❌ Unidade ${UNIT_CODE} não encontrada.`);
  }

  console.log(`✅ Unidade: ${unit.name} (${unit.id})\n`);

  // 2. Buscar primeira turma com alunos
  const classroom = await prisma.classroom.findFirst({
    where: { unitId: unit.id },
    include: {
      enrollments: {
        where: { status: 'ATIVA' },
        include: { child: true },
        take: 5,
      },
    },
  });

  if (!classroom || classroom.enrollments.length === 0) {
    console.log('⚠️  Nenhuma turma com alunos encontrada. Execute import-arara-2026.ts primeiro.');
    return;
  }

  console.log(`✅ Turma: ${classroom.name} (${classroom.id})`);
  console.log(`   Alunos: ${classroom.enrollments.length}\n`);

  // 3. Buscar primeira entrada da matriz curricular (para vincular eventos)
  const curriculumEntry = await prisma.curriculumMatrixEntry.findFirst({
    where: {
      matrix: {
        mantenedoraId: unit.mantenedoraId,
      },
    },
  });

  if (!curriculumEntry) {
    console.log('⚠️  Nenhuma entrada de matriz curricular encontrada. Criando placeholder...');
    // Criar matriz e entrada placeholder
    const matrix = await prisma.curriculumMatrix.create({
      data: {
        name: 'Matriz Zelare 2026',
        year: 2026,
        segment: 'EI01',
        description: 'Matriz curricular Zelare',
        mantenedoraId: unit.mantenedoraId,
        isActive: true,
      },
    });

    const todayEntry = new Date();
    const entry = await prisma.curriculumMatrixEntry.create({
      data: {
        matrixId: matrix.id,
        date: todayEntry,
        weekOfYear: 1,
        dayOfWeek: todayEntry.getDay() || 1,
        campoDeExperiencia: 'O_EU_O_OUTRO_E_O_NOS',
        objetivoBNCC: 'Perceber que suas ações têm efeitos nas outras crianças e nos adultos',
        objetivoBNCCCode: 'EI01EO01',
        objetivoCurriculo: 'Desenvolver a percepção de si e do outro',
        intencionalidade: 'Exploração e Descoberta',
        exemploAtividade: 'Atividades de exploração sensorial e descoberta',
      },
    });

    console.log(`   ✅ Matriz e entrada criadas\n`);
  }

  const entryId = curriculumEntry?.id || (await prisma.curriculumMatrixEntry.findFirst())!.id;

  // 4. Criar DiaryEvents com microgestos (hoje)
  const today = new Date();
  today.setHours(9, 0, 0, 0);

  let eventsCreated = 0;

  for (const enrollment of classroom.enrollments) {
    const child = enrollment.child;

    // Evento 1: Alimentação (PUBLICADO)
    const medicaoAlimentar: Prisma.JsonObject = {
      cafe: { consumiu: true, quantidade: 'TOTAL', observacao: 'Comeu tudo com apetite' },
      lanche: { consumiu: true, quantidade: 'PARCIAL', observacao: 'Aceitou frutas' },
      almoco: { consumiu: true, quantidade: 'TOTAL', observacao: 'Gostou do arroz e feijão' },
    };

    await prisma.diaryEvent.create({
      data: {
        mantenedoraId: unit.mantenedoraId,
        unitId: unit.id,
        classroomId: classroom.id,
        childId: child.id,
        curriculumEntryId: entryId,
        type: 'REFEICAO',
        title: 'Alimentação do dia',
        description: 'Registro de alimentação',
        eventDate: today,
        medicaoAlimentar,
        status: 'PUBLICADO',
      },
    });

    // Evento 2: Sono (PUBLICADO)
    const sonoMinutos: Prisma.JsonObject = {
      inicio: '13:00',
      fim: '15:30',
      totalMinutos: 150,
      qualidade: 'BOM',
      observacao: 'Dormiu tranquilamente',
    };

    await prisma.diaryEvent.create({
      data: {
        mantenedoraId: unit.mantenedoraId,
        unitId: unit.id,
        classroomId: classroom.id,
        childId: child.id,
        curriculumEntryId: entryId,
        type: 'SONO',
        title: 'Sono da tarde',
        description: 'Registro de sono',
        eventDate: today,
        sonoMinutos,
        status: 'PUBLICADO',
      },
    });

    // Evento 3: Troca de fralda (PUBLICADO)
    const trocaFraldaStatus: Prisma.JsonObject = {
      horario: '10:30',
      tipo: 'XIXI_E_COCO',
      condicao: 'NORMAL',
      observacao: 'Sem irritações',
    };

    await prisma.diaryEvent.create({
      data: {
        mantenedoraId: unit.mantenedoraId,
        unitId: unit.id,
        classroomId: classroom.id,
        childId: child.id,
        curriculumEntryId: entryId,
        type: 'HIGIENE',
        title: 'Troca de fralda',
        description: 'Registro de higiene',
        eventDate: today,
        trocaFraldaStatus,
        status: 'PUBLICADO',
      },
    });

    // Evento 4: Atividade pedagógica
    await prisma.diaryEvent.create({
      data: {
        mantenedoraId: unit.mantenedoraId,
        unitId: unit.id,
        classroomId: classroom.id,
        childId: child.id,
        curriculumEntryId: entryId,
        type: 'ATIVIDADE_PEDAGOGICA',
        title: 'Brincadeira livre no parque',
        description: 'Criança explorou o escorregador e balanço',
        eventDate: today,
        observations: 'Demonstrou muita alegria e interação com colegas',
        developmentNotes: 'Desenvolvimento motor grosso evidente',
        status: 'PUBLICADO',
      },
    });

    eventsCreated += 4;
    console.log(`   ✅ ${child.firstName} ${child.lastName}: 4 eventos criados`);
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   - Turma: ${classroom.name}`);
  console.log(`   - Alunos: ${classroom.enrollments.length}`);
  console.log(`   - Eventos criados: ${eventsCreated}`);
  console.log(`   - Data: ${today.toISOString().split('T')[0]}`);
  console.log(`\n✅ Seed concluído! Dashboard do professor agora tem dados.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
