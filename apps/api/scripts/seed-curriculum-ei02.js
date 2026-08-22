const { PrismaClient, CampoDeExperiencia } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed da Matriz Curricular EI02 (Crianças Bem Pequenas 19 meses - 3 anos 11 meses)
 * Baseado na Sequência Pedagógica Piloto 2026
 */

async function main() {
  console.log('🌱 Importando Matriz Curricular EI02 (Crianças Bem Pequenas)...');

  const mantenedoraEmail = process.env.SEED_MANTENEDORA_EMAIL;
  if (!mantenedoraEmail) throw new Error('Defina SEED_MANTENEDORA_EMAIL fora do repositório antes de executar este seed');

  const mantenedora = await prisma.mantenedora.findFirst({
    where: { email: mantenedoraEmail },
  });

  if (!mantenedora) throw new Error('Mantenedora não encontrada');

  let matrix = await prisma.curriculumMatrix.findFirst({
    where: { code: 'EI02-2026', mantenedoraId: mantenedora.id },
  });

  if (!matrix) {
    matrix = await prisma.curriculumMatrix.create({
      data: {
        code: 'EI02-2026',
        name: 'Matriz Curricular EI02 - Crianças Bem Pequenas (19m-3a11m)',
        description: 'Sequência Pedagógica Piloto 2026 - Crianças Bem Pequenas',
        ageGroupMin: 19,
        ageGroupMax: 47,
        year: 2026,
        startDate: new Date('2026-02-09'),
        endDate: new Date('2026-12-18'),
        mantenedoraId: mantenedora.id,
        isActive: true,
      },
    });
    console.log(`✅ Matriz criada: ${matrix.name}`);
  } else {
    console.log(`ℹ️  Matriz já existe: ${matrix.name}`);
  }

  // Semana 1: Acolhimento
  const semana1 = [
    {
      date: new Date('2026-02-09'),
      weekOfYear: 6,
      dayOfWeek: 1,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.O_EU_O_OUTRO_E_O_NOS,
      objetivoBNCCCode: 'EI02EO01',
      objetivoBNCC: 'Demonstrar atitudes de cuidado e solidariedade na interação com crianças e adultos',
      objetivoCurriculo: 'Demonstrar atitudes de cuidado e solidariedade na interação com crianças e adultos',
      intencionalidade: 'Promover o acolhimento e a construção de vínculos afetivos no retorno às aulas',
      exemploAtividade: 'Roda de conversa com apresentação dos colegas, músicas de boas-vindas e brincadeiras de integração',
    },
    {
      date: new Date('2026-02-10'),
      weekOfYear: 6,
      dayOfWeek: 2,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.CORPO_GESTOS_E_MOVIMENTOS,
      objetivoBNCCCode: 'EI02CG01',
      objetivoBNCC: 'Apropriar-se de gestos e movimentos de sua cultura no cuidado de si e nos jogos e brincadeiras',
      objetivoCurriculo: 'Apropriar-se de gestos e movimentos de sua cultura no cuidado de si e nos jogos e brincadeiras',
      intencionalidade: 'Desenvolver autonomia nos cuidados pessoais e nas brincadeiras',
      exemploAtividade: 'Circuito motor com desafios de pular, correr, equilibrar-se e brincadeiras tradicionais',
    },
    {
      date: new Date('2026-02-11'),
      weekOfYear: 6,
      dayOfWeek: 3,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.TRACOS_SONS_CORES_E_FORMAS,
      objetivoBNCCCode: 'EI02TS02',
      objetivoBNCC: 'Utilizar materiais variados com possibilidades de manipulação (argila, massa de modelar), explorando cores, texturas, superfícies, planos, formas e volumes ao criar objetos tridimensionais',
      objetivoCurriculo: 'Utilizar materiais variados explorando cores, texturas e formas',
      intencionalidade: 'Estimular a criatividade e a expressão através de materiais tridimensionais',
      exemploAtividade: 'Exploração livre de massinha de modelar caseira, criando formas e objetos',
    },
    {
      date: new Date('2026-02-12'),
      weekOfYear: 6,
      dayOfWeek: 4,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO,
      objetivoBNCCCode: 'EI02EF01',
      objetivoBNCC: 'Dialogar com crianças e adultos, expressando seus desejos, necessidades, sentimentos e opiniões',
      objetivoCurriculo: 'Dialogar com crianças e adultos, expressando seus desejos e sentimentos',
      intencionalidade: 'Ampliar a linguagem oral e a capacidade de expressão',
      exemploAtividade: 'Contação de histórias interativas com fantoches e momentos de diálogo sobre a história',
    },
    {
      date: new Date('2026-02-13'),
      weekOfYear: 6,
      dayOfWeek: 5,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES,
      objetivoBNCCCode: 'EI02ET01',
      objetivoBNCC: 'Explorar e descrever semelhanças e diferenças entre as características e propriedades dos objetos (textura, massa, tamanho)',
      objetivoCurriculo: 'Explorar e descrever semelhanças e diferenças entre objetos',
      intencionalidade: 'Desenvolver a observação e a capacidade de comparação',
      exemploAtividade: 'Exploração de caixas sensoriais com objetos de diferentes texturas, tamanhos e pesos',
    },
  ];

  for (const entry of semana1) {
    await prisma.curriculumMatrixEntry.upsert({
      where: { matrixId_date: { matrixId: matrix.id, date: entry.date } },
      update: entry,
      create: { ...entry, matrixId: matrix.id },
    });
  }

  console.log(`✅ ${semana1.length} entradas importadas para EI02`);
  console.log(`📊 Matriz ID: ${matrix.id}`);
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Erro:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
