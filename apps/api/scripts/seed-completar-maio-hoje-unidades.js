/**
 * seed-completar-maio-hoje-unidades.js
 *
 * Completa o banco com dados estruturais seguros para o Zelare/Conexa:
 * 1. Confere/cria as unidades oficiais cadastradas em prisma/units.json.
 * 2. Confere/cria matrizes curriculares 2026 para EI01, EI02 e EI03.
 * 3. Completa entradas da matriz curricular do período de maio até hoje.
 *
 * NÃO altera schema, NÃO cria migrations e NÃO apaga dados.
 * Script idempotente: pode rodar mais de uma vez.
 *
 * Variáveis opcionais:
 *   MANTENEDORA_ID=<id>        força qual mantenedora usar
 *   START_DATE=2026-05-01      início do preenchimento
 *   END_DATE=2026-06-12        fim do preenchimento; padrão: hoje
 *   FORCE_UPDATE=true          atualiza entradas existentes; padrão: false
 *   DRY_RUN=true               só mostra o que faria; padrão: false
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const START_DATE = process.env.START_DATE || '2026-05-01';
const END_DATE = process.env.END_DATE || todayISO();
const FORCE_UPDATE = String(process.env.FORCE_UPDATE || '').toLowerCase() === 'true';
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';

const SEGMENTS = ['EI01', 'EI02', 'EI03'];

const CAMPOS = [
  'O_EU_O_OUTRO_E_O_NOS',
  'CORPO_GESTOS_E_MOVIMENTOS',
  'TRACOS_SONS_CORES_E_FORMAS',
  'ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO',
  'ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES',
];

const OBJETIVOS = {
  EI01: {
    O_EU_O_OUTRO_E_O_NOS: {
      code: 'EI01EO03',
      bncc: 'Estabelecer vínculos afetivos com adultos e outras crianças, sentindo-se protegido e seguro no ambiente educativo.',
      curriculo: 'Perceber o ambiente de educação coletiva como espaço de acolhimento, vínculo, cuidado e segurança.',
      intencionalidade: 'Fortalecer vínculos, segurança emocional, pertencimento e confiança nas rotinas de cuidado.'
    },
    CORPO_GESTOS_E_MOVIMENTOS: {
      code: 'EI01CG01',
      bncc: 'Movimentar as partes do corpo para exprimir corporalmente emoções, necessidades e desejos.',
      curriculo: 'Explorar movimentos corporais simples em brincadeiras, cuidados e interações cotidianas.',
      intencionalidade: 'Ampliar a expressão corporal, a percepção do próprio corpo e a comunicação por gestos e movimentos.'
    },
    TRACOS_SONS_CORES_E_FORMAS: {
      code: 'EI01TS02',
      bncc: 'Manipular materiais diversos e variados para explorar cores, formas, texturas e sons.',
      curriculo: 'Explorar materiais sensoriais, objetos coloridos, sons e texturas em experiências de descoberta.',
      intencionalidade: 'Estimular percepção sensorial, curiosidade, exploração livre e prazer nas descobertas.'
    },
    ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO: {
      code: 'EI01EF04',
      bncc: 'Reconhecer quando é chamado por seu nome e reconhecer os nomes das pessoas com quem convive.',
      curriculo: 'Participar de situações de escuta, cantigas, histórias breves e reconhecimento de nomes e vozes.',
      intencionalidade: 'Favorecer linguagem inicial, escuta atenta, vínculo afetivo e identificação pessoal.'
    },
    ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES: {
      code: 'EI01ET01',
      bncc: 'Explorar o ambiente pela ação e observação, manipulando, experimentando e fazendo descobertas.',
      curriculo: 'Observar e explorar espaços, objetos e pequenas transformações por meio da ação corporal e sensorial.',
      intencionalidade: 'Desenvolver curiosidade, observação, exploração do ambiente e noções iniciais de causa e efeito.'
    },
  },
  EI02: {
    O_EU_O_OUTRO_E_O_NOS: {
      code: 'EI02EO01',
      bncc: 'Demonstrar atitudes de cuidado e solidariedade na interação com crianças e adultos.',
      curriculo: 'Vivenciar atitudes de cuidado, cooperação, respeito e convivência nas interações do grupo.',
      intencionalidade: 'Promover convivência, empatia, cuidado com o outro e participação nas rotinas coletivas.'
    },
    CORPO_GESTOS_E_MOVIMENTOS: {
      code: 'EI02CG03',
      bncc: 'Explorar formas de deslocamento no espaço, combinando movimentos e seguindo orientações.',
      curriculo: 'Explorar movimentos amplos, deslocamentos, equilíbrio e coordenação em brincadeiras orientadas.',
      intencionalidade: 'Desenvolver autonomia corporal, coordenação motora, orientação espacial e participação ativa.'
    },
    TRACOS_SONS_CORES_E_FORMAS: {
      code: 'EI02TS02',
      bncc: 'Utilizar materiais variados com possibilidades de manipulação, explorando cores, texturas, superfícies, planos e formas.',
      curriculo: 'Experimentar materiais, suportes, cores e formas em produções livres e orientadas.',
      intencionalidade: 'Ampliar repertório expressivo, criatividade, coordenação fina e exploração estética.'
    },
    ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO: {
      code: 'EI02EF03',
      bncc: 'Demonstrar interesse e atenção ao ouvir a leitura de histórias e outros textos.',
      curriculo: 'Participar de rodas de conversa, escuta de histórias, músicas, parlendas e reconto com apoio do adulto.',
      intencionalidade: 'Fortalecer oralidade, escuta, imaginação, memória e interesse pela linguagem literária.'
    },
    ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES: {
      code: 'EI02ET03',
      bncc: 'Compartilhar, com outras crianças, situações de cuidado de plantas e animais nos espaços da instituição e fora dela.',
      curriculo: 'Observar natureza, objetos, quantidades, agrupamentos e transformações em experiências concretas.',
      intencionalidade: 'Estimular observação, comparação, cuidado com o ambiente e pensamento investigativo.'
    },
  },
  EI03: {
    O_EU_O_OUTRO_E_O_NOS: {
      code: 'EI03EO01',
      bncc: 'Demonstrar empatia pelos outros, percebendo que as pessoas têm diferentes sentimentos, necessidades e maneiras de pensar e agir.',
      curriculo: 'Participar de situações de diálogo, cooperação, resolução de conflitos e respeito às diferenças.',
      intencionalidade: 'Desenvolver empatia, autonomia, escuta, convivência democrática e respeito ao coletivo.'
    },
    CORPO_GESTOS_E_MOVIMENTOS: {
      code: 'EI03CG03',
      bncc: 'Criar movimentos, gestos, olhares e mímicas em brincadeiras, jogos e atividades artísticas.',
      curriculo: 'Explorar movimentos expressivos, jogos corporais, dramatizações e brincadeiras com regras simples.',
      intencionalidade: 'Ampliar expressão corporal, criatividade, consciência corporal e participação em grupo.'
    },
    TRACOS_SONS_CORES_E_FORMAS: {
      code: 'EI03TS02',
      bncc: 'Expressar-se livremente por meio de desenho, pintura, colagem, dobradura e escultura, criando produções bidimensionais e tridimensionais.',
      curriculo: 'Produzir registros artísticos com diferentes materiais, técnicas, cores, formas e suportes.',
      intencionalidade: 'Valorizar autoria, expressão estética, criatividade, observação e coordenação motora fina.'
    },
    ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO: {
      code: 'EI03EF01',
      bncc: 'Expressar ideias, desejos e sentimentos sobre suas vivências, por meio da linguagem oral e escrita espontânea.',
      curriculo: 'Participar de conversas, relatos, narrativas, reconto, registros espontâneos e leitura de imagens.',
      intencionalidade: 'Ampliar oralidade, argumentação, imaginação, escuta e aproximação da cultura escrita.'
    },
    ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES: {
      code: 'EI03ET01',
      bncc: 'Estabelecer relações de comparação entre objetos, observando suas propriedades.',
      curriculo: 'Investigar objetos, fenômenos, quantidades, medidas, tempo, espaços e transformações do cotidiano.',
      intencionalidade: 'Promover pensamento lógico, comparação, classificação, investigação e resolução de problemas.'
    },
  },
};

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dayOfWeekMonFri(date) {
  const jsDay = date.getUTCDay();
  if (jsDay === 0) return 7;
  return jsDay;
}

function isWeekday(date) {
  const d = date.getUTCDay();
  return d >= 1 && d <= 5;
}

function isoWeek(date) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

function bimesterFromDate(date) {
  const month = date.getUTCMonth() + 1;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

function listWeekdays(startISO, endISO) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Datas inválidas. START_DATE=${startISO}, END_DATE=${endISO}`);
  }
  if (start > end) {
    throw new Error(`START_DATE não pode ser maior que END_DATE. START_DATE=${startISO}, END_DATE=${endISO}`);
  }
  const dates = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWeekday(d)) dates.push(new Date(d.getTime()));
  }
  return dates;
}

async function findOrCreateMantenedora() {
  if (process.env.MANTENEDORA_ID) {
    const mantenedora = await prisma.mantenedora.findUnique({ where: { id: process.env.MANTENEDORA_ID } });
    if (!mantenedora) throw new Error(`MANTENEDORA_ID informado não foi encontrado: ${process.env.MANTENEDORA_ID}`);
    return mantenedora;
  }

  const withUnits = await prisma.mantenedora.findFirst({
    where: { isActive: true, units: { some: {} } },
    orderBy: { createdAt: 'asc' },
  });
  if (withUnits) return withUnits;

  const active = await prisma.mantenedora.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  if (active) return active;

  const existingByCnpj = await prisma.mantenedora.findUnique({ where: { cnpj: '00.000.000/0001-00' } });
  if (existingByCnpj) return existingByCnpj;

  if (DRY_RUN) {
    return { id: 'dry-run-mantenedora', name: 'Zelare Demonstração', cnpj: '00.000.000/0001-00' };
  }

  return prisma.mantenedora.create({
    data: {
      name: 'Zelare Demonstração',
      cnpj: '00.000.000/0001-00',
      email: 'contato@zelare.local',
      phone: '(00) 0000-0000',
      address: 'Endereço não informado',
      city: 'Cidade não informada',
      state: 'DF',
      zipCode: '00000-000',
      plan: 'professional',
      maxUnits: 50,
      maxUsers: 1000,
      isActive: true,
    },
  });
}

function loadUnits() {
  const candidates = [
    path.resolve(__dirname, '..', 'prisma', 'units.json'),
    path.resolve(__dirname, '..', 'dist', 'prisma', 'units.json'),
    path.resolve(process.cwd(), 'prisma', 'units.json'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`Arquivo units.json não encontrado. Caminhos testados: ${candidates.join(', ')}`);
  return JSON.parse(fs.readFileSync(found, 'utf8'));
}

async function ensureUnits(mantenedoraId) {
  const units = loadUnits();
  const result = { created: 0, updated: 0, skipped: 0 };

  for (const unit of units) {
    const existing = await prisma.unit.findFirst({ where: { mantenedoraId, code: unit.code } });
    const data = {
      name: unit.name,
      city: unit.city || null,
      state: unit.state || null,
      zipCode: unit.zipCode || null,
      address: unit.address || null,
      phone: unit.phone || null,
      email: unit.email || null,
      isActive: unit.isActive !== false,
      capacity: unit.capacity || 100,
      ageGroupsServed: unit.ageGroupsServed || '0-4',
    };

    if (!existing) {
      result.created++;
      if (!DRY_RUN) {
        await prisma.unit.create({ data: { ...data, code: unit.code, mantenedoraId } });
      }
    } else {
      result.updated++;
      if (!DRY_RUN) {
        await prisma.unit.update({ where: { id: existing.id }, data });
      }
    }
  }

  return { ...result, totalReferencia: units.length };
}

async function ensureMatrix(mantenedoraId, segment) {
  const existing = await prisma.curriculumMatrix.findFirst({
    where: { mantenedoraId, year: 2026, segment, version: 1 },
  });

  if (existing) return existing;

  if (DRY_RUN) {
    return { id: `dry-run-matrix-${segment}`, segment, year: 2026, version: 1 };
  }

  return prisma.curriculumMatrix.create({
    data: {
      mantenedoraId,
      name: `Matriz Curricular ${segment} - 2026`,
      year: 2026,
      segment,
      version: 1,
      description: 'Matriz curricular 2026 complementada automaticamente pelo script de saneamento do Zelare.',
      isActive: true,
    },
  });
}

function buildEntry(segment, date, ordinal) {
  const campo = CAMPOS[ordinal % CAMPOS.length];
  const base = OBJETIVOS[segment][campo];
  const iso = formatISODate(date);
  const readable = iso.split('-').reverse().join('/');

  return {
    date,
    weekOfYear: isoWeek(date),
    dayOfWeek: dayOfWeekMonFri(date),
    bimester: bimesterFromDate(date),
    campoDeExperiencia: campo,
    objetivoBNCC: base.bncc,
    objetivoBNCCCode: base.code,
    objetivoCurriculo: base.curriculo,
    intencionalidade: `${base.intencionalidade} Complementação do período letivo de maio até a data ${readable}, mantendo continuidade pedagógica e registro rastreável no sistema.`,
    exemploAtividade: sugestaoAtividade(segment, campo),
  };
}

function sugestaoAtividade(segment, campo) {
  const common = {
    O_EU_O_OUTRO_E_O_NOS: 'Roda de acolhida, combinados de convivência, identificação de sentimentos e cuidado coletivo.',
    CORPO_GESTOS_E_MOVIMENTOS: 'Circuito motor, brincadeiras corporais, deslocamentos orientados, música e movimento.',
    TRACOS_SONS_CORES_E_FORMAS: 'Exploração de cores, texturas, desenho, colagem, pintura, música e materiais sensoriais.',
    ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO: 'Contação de história, reconto, cantigas, conversa orientada, leitura de imagens e registros.',
    ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES: 'Exploração de objetos, natureza, agrupamentos, comparação, sequência, rotina e pequenas investigações.',
  };
  if (segment === 'EI01') return `Vivência sensorial adaptada para bebês: ${common[campo]}`;
  if (segment === 'EI02') return `Vivência orientada para crianças bem pequenas: ${common[campo]}`;
  return `Vivência investigativa e expressiva para crianças pequenas: ${common[campo]}`;
}

async function ensureCurriculumEntries(mantenedoraId) {
  const dates = listWeekdays(START_DATE, END_DATE);
  const summary = {};

  for (const segment of SEGMENTS) {
    const matrix = await ensureMatrix(mantenedoraId, segment);
    summary[segment] = { matrixId: matrix.id, created: 0, updated: 0, existing: 0, totalEsperado: dates.length };

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const existing = DRY_RUN
        ? null
        : await prisma.curriculumMatrixEntry.findFirst({ where: { matrixId: matrix.id, date } });

      const entry = buildEntry(segment, date, i);

      if (!existing) {
        summary[segment].created++;
        if (!DRY_RUN) {
          await prisma.curriculumMatrixEntry.create({ data: { matrixId: matrix.id, ...entry } });
        }
      } else if (FORCE_UPDATE) {
        summary[segment].updated++;
        if (!DRY_RUN) {
          await prisma.curriculumMatrixEntry.update({ where: { id: existing.id }, data: entry });
        }
      } else {
        summary[segment].existing++;
      }
    }
  }

  return summary;
}

async function diagnostic(mantenedoraId) {
  const units = await prisma.unit.count({ where: { mantenedoraId } });
  const matrices = await prisma.curriculumMatrix.findMany({
    where: { mantenedoraId, year: 2026, segment: { in: SEGMENTS } },
    select: { id: true, segment: true, year: true, version: true, _count: { select: { entries: true } } },
    orderBy: [{ segment: 'asc' }, { version: 'asc' }],
  });
  return { units, matrices };
}

async function main() {
  console.log('============================================================');
  console.log('Zelare — completar banco: unidades + matriz maio até hoje');
  console.log('============================================================');
  console.log(`START_DATE: ${START_DATE}`);
  console.log(`END_DATE: ${END_DATE}`);
  console.log(`FORCE_UPDATE: ${FORCE_UPDATE}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('');

  const mantenedora = await findOrCreateMantenedora();
  console.log(`Mantenedora usada: ${mantenedora.name} (${mantenedora.id})`);

  if (!DRY_RUN) {
    const before = await diagnostic(mantenedora.id);
    console.log('\nDiagnóstico antes:');
    console.log(`- Unidades cadastradas: ${before.units}`);
    for (const m of before.matrices) {
      console.log(`- Matriz ${m.segment}/${m.year} v${m.version}: ${m._count.entries} entradas`);
    }
  }

  console.log('\n1) Conferindo unidades...');
  const unitsSummary = await ensureUnits(mantenedora.id);
  console.log(`- Referência de unidades: ${unitsSummary.totalReferencia}`);
  console.log(`- Criadas: ${unitsSummary.created}`);
  console.log(`- Atualizadas: ${unitsSummary.updated}`);

  console.log('\n2) Completando matrizes curriculares...');
  const curriculumSummary = await ensureCurriculumEntries(mantenedora.id);
  for (const segment of SEGMENTS) {
    const s = curriculumSummary[segment];
    console.log(`- ${segment}: esperadas ${s.totalEsperado}, criadas ${s.created}, atualizadas ${s.updated}, já existentes ${s.existing}`);
  }

  if (!DRY_RUN) {
    const after = await diagnostic(mantenedora.id);
    console.log('\nDiagnóstico depois:');
    console.log(`- Unidades cadastradas: ${after.units}`);
    for (const m of after.matrices) {
      console.log(`- Matriz ${m.segment}/${m.year} v${m.version}: ${m._count.entries} entradas`);
    }
  }

  console.log('\n✅ Saneamento concluído. Nenhuma migration foi criada ou executada por este script.');
}

main()
  .catch((error) => {
    console.error('\n❌ Erro ao completar banco:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
