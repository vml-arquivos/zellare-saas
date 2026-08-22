const { PrismaClient, CampoDeExperiencia } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed da Matriz Curricular EI01 (Bebês 0-18 meses)
 * Baseado na Sequência Pedagógica Piloto 2026
 */

async function main() {
  console.log('🌱 Importando Matriz Curricular EI01 (Bebês)...');

  const mantenedoraEmail = process.env.SEED_MANTENEDORA_EMAIL;
  if (!mantenedoraEmail) throw new Error('Defina SEED_MANTENEDORA_EMAIL fora do repositório antes de executar este seed');

  // Buscar somente a mantenedora explicitamente autorizada pelo operador
  const mantenedora = await prisma.mantenedora.findFirst({
    where: { email: mantenedoraEmail },
  });

  if (!mantenedora) {
    throw new Error('Mantenedora não encontrada');
  }

  const unit = await prisma.unit.findFirst({
    where: { mantenedoraId: mantenedora.id },
  });

  if (!unit) {
    throw new Error('Unidade não encontrada');
  }

  // Criar ou buscar matriz EI01
  let matrix = await prisma.curriculumMatrix.findFirst({
    where: {
      code: 'EI01-2026',
      mantenedoraId: mantenedora.id,
    },
  });

  if (!matrix) {
    matrix = await prisma.curriculumMatrix.create({
      data: {
        code: 'EI01-2026',
        name: 'Matriz Curricular EI01 - Bebês (0-18 meses)',
        description: 'Sequência Pedagógica Piloto 2026 - Bebês',
        ageGroupMin: 0,
        ageGroupMax: 18,
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

  // Semana 1: 09/02 a 13/02/2026 - Acolhimento e Inserção
  const semana1 = [
    {
      date: new Date('2026-02-09'), // Segunda
      weekOfYear: 6,
      dayOfWeek: 1,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.O_EU_O_OUTRO_E_O_NOS,
      objetivoBNCCCode: 'EI01EO03',
      objetivoBNCC: 'Estabelecer vínculos afetivos com adultos e outras crianças',
      objetivoCurriculo: 'Perceber o ambiente de educação coletiva como um local afetivo e protetor',
      intencionalidade: 'Favorecer a adaptação inicial dos bebês, promovendo vínculo, segurança emocional e sentimento de pertencimento ao espaço escolar',
      exemploAtividade: 'Acolhimento no tapete com músicas suaves, colo e exploração livre da sala com presença constante do adulto de referência',
    },
    {
      date: new Date('2026-02-10'), // Terça
      weekOfYear: 6,
      dayOfWeek: 2,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.CORPO_GESTOS_E_MOVIMENTOS,
      objetivoBNCCCode: 'EI01CG01',
      objetivoBNCC: 'Movimentar as partes do corpo para exprimir corporalmente emoções, necessidades e desejos',
      objetivoCurriculo: 'Movimentar as partes do corpo para exprimir corporalmente emoções, necessidades e desejos',
      intencionalidade: 'Estimular a expressão corporal como forma primordial de comunicação dos bebês',
      exemploAtividade: 'Brincadeiras corporais com músicas, espelho e gestos, valorizando movimentos espontâneos e expressões faciais',
    },
    {
      date: new Date('2026-02-11'), // Quarta
      weekOfYear: 6,
      dayOfWeek: 3,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.TRACOS_SONS_CORES_E_FORMAS,
      objetivoBNCCCode: 'EI01TS01',
      objetivoBNCC: 'Explorar sons produzidos com o próprio corpo e com objetos do ambiente',
      objetivoCurriculo: 'Explorar sons produzidos com o próprio corpo e com objetos do ambiente',
      intencionalidade: 'Promover a exploração sensorial auditiva e a descoberta de sons diversos',
      exemploAtividade: 'Exploração de chocalhos, tambores, panelas e objetos sonoros diversos, estimulando a curiosidade e a escuta',
    },
    {
      date: new Date('2026-02-12'), // Quinta
      weekOfYear: 6,
      dayOfWeek: 4,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO,
      objetivoBNCCCode: 'EI01EF01',
      objetivoBNCC: 'Reconhecer quando é chamado por seu nome e reconhecer os nomes de pessoas com quem convive',
      objetivoCurriculo: 'Reconhecer quando é chamado por seu nome e reconhecer os nomes de pessoas com quem convive',
      intencionalidade: 'Fortalecer a identidade e o reconhecimento do próprio nome e dos colegas',
      exemploAtividade: 'Chamada lúdica com fotos, músicas personalizadas e interações afetivas ao chamar cada bebê pelo nome',
    },
    {
      date: new Date('2026-02-13'), // Sexta
      weekOfYear: 6,
      dayOfWeek: 5,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES,
      objetivoBNCCCode: 'EI01ET01',
      objetivoBNCC: 'Explorar e descobrir as propriedades de objetos e materiais (odor, cor, sabor, temperatura)',
      objetivoCurriculo: 'Explorar e descobrir as propriedades de objetos e materiais (odor, cor, sabor, temperatura)',
      intencionalidade: 'Estimular a exploração sensorial e a descoberta das propriedades dos materiais',
      exemploAtividade: 'Cesto de tesouros com materiais naturais e seguros (tecidos, madeira, esponjas) para exploração livre',
    },
  ];

  // Inserir entradas da semana 1
  for (const entry of semana1) {
    await prisma.curriculumMatrixEntry.upsert({
      where: {
        matrixId_date: {
          matrixId: matrix.id,
          date: entry.date,
        },
      },
      update: entry,
      create: {
        ...entry,
        matrixId: matrix.id,
      },
    });
  }

  console.log(`✅ ${semana1.length} entradas da Semana 1 importadas`);

  // Semana 3: 23/02 a 27/02/2026 (Semana 2 é recesso)
  const semana3 = [
    {
      date: new Date('2026-02-23'),
      weekOfYear: 8,
      dayOfWeek: 1,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.O_EU_O_OUTRO_E_O_NOS,
      objetivoBNCCCode: 'EI01EO02',
      objetivoBNCC: 'Perceber as possibilidades e os limites de seu corpo nas brincadeiras e interações',
      objetivoCurriculo: 'Perceber as possibilidades e os limites de seu corpo nas brincadeiras e interações',
      intencionalidade: 'Promover o autoconhecimento corporal e a consciência dos próprios limites',
      exemploAtividade: 'Circuito motor com almofadas, túneis e rampas suaves para exploração corporal',
    },
    {
      date: new Date('2026-02-24'),
      weekOfYear: 8,
      dayOfWeek: 2,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.CORPO_GESTOS_E_MOVIMENTOS,
      objetivoBNCCCode: 'EI01CG02',
      objetivoBNCC: 'Experimentar as possibilidades corporais nas brincadeiras e interações em ambientes acolhedores e desafiantes',
      objetivoCurriculo: 'Experimentar as possibilidades corporais nas brincadeiras e interações em ambientes acolhedores e desafiantes',
      intencionalidade: 'Ampliar o repertório motor através de desafios adequados à faixa etária',
      exemploAtividade: 'Brincadeiras no tatame com bolas, rolos e obstáculos baixos para engatinhar e rolar',
    },
    {
      date: new Date('2026-02-25'),
      weekOfYear: 8,
      dayOfWeek: 3,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.TRACOS_SONS_CORES_E_FORMAS,
      objetivoBNCCCode: 'EI01TS02',
      objetivoBNCC: 'Traçar marcas gráficas, em diferentes suportes, usando instrumentos riscantes e tintas',
      objetivoCurriculo: 'Traçar marcas gráficas, em diferentes suportes, usando instrumentos riscantes e tintas',
      intencionalidade: 'Iniciar a expressão gráfica e a exploração de materiais artísticos',
      exemploAtividade: 'Pintura com tinta comestível (beterraba, espinafre) em papel kraft no chão',
    },
    {
      date: new Date('2026-02-26'),
      weekOfYear: 8,
      dayOfWeek: 4,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO,
      objetivoBNCCCode: 'EI01EF02',
      objetivoBNCC: 'Demonstrar interesse ao ouvir a leitura de poemas e a apresentação de músicas',
      objetivoCurriculo: 'Demonstrar interesse ao ouvir a leitura de poemas e a apresentação de músicas',
      intencionalidade: 'Desenvolver a escuta atenta e o prazer pela linguagem poética e musical',
      exemploAtividade: 'Contação de histórias com fantoches, livros de pano e músicas de ninar',
    },
    {
      date: new Date('2026-02-27'),
      weekOfYear: 8,
      dayOfWeek: 5,
      bimester: 1,
      campoDeExperiencia: CampoDeExperiencia.ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES,
      objetivoBNCCCode: 'EI01ET02',
      objetivoBNCC: 'Explorar relações de causa e efeito (transbordar, tingir, misturar, mover e remover) na interação com o mundo físico',
      objetivoCurriculo: 'Explorar relações de causa e efeito na interação com o mundo físico',
      intencionalidade: 'Estimular a investigação e a descoberta de relações de causa e efeito',
      exemploAtividade: 'Brincadeiras com água, potes e objetos flutuantes para explorar transbordar e mover',
    },
  ];

  for (const entry of semana3) {
    await prisma.curriculumMatrixEntry.upsert({
      where: {
        matrixId_date: {
          matrixId: matrix.id,
          date: entry.date,
        },
      },
      update: entry,
      create: {
        ...entry,
        matrixId: matrix.id,
      },
    });
  }

  console.log(`✅ ${semana3.length} entradas da Semana 3 importadas`);
  console.log(`\n✅ Total: ${semana1.length + semana3.length} dias letivos importados para EI01`);
  console.log(`📊 Matriz ID: ${matrix.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
