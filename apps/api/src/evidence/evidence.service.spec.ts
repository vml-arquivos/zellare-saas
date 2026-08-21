import { EvidenceService } from './evidence.service';
import { EvidenceSensitivity, EvidenceVisibility, RoleLevel } from '@prisma/client';

describe('EvidenceService', () => {
  const prisma = {
    child: {
      findUnique: jest.fn(),
    },
    childEvidence: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    classroomTeacher: {
      findMany: jest.fn(),
    },
    classroomPost: {
      findUnique: jest.fn(),
    },
  } as any;

  const user = {
    sub: 'user-1',
    mantenedoraId: 'tenant-1',
    unitId: 'unit-1',
    roles: [{ level: RoleLevel.DEVELOPER }],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.child.findUnique.mockResolvedValue({
      id: 'child-1',
      mantenedoraId: 'tenant-1',
      unitId: 'unit-1',
      enrollments: [{ classroomId: 'class-1' }],
    });
    prisma.childEvidence.upsert.mockImplementation(async ({ create }: any) => ({ id: 'evidence-1', ...create }));
  });

  it('faz upsert idempotente por origem e criança', async () => {
    const service = new EvidenceService(prisma);

    await service.syncDiaryEvent({
      id: 'diary-1',
      childId: 'child-1',
      mantenedoraId: 'tenant-1',
      unitId: 'unit-1',
      classroomId: 'class-1',
      type: 'COMPORTAMENTO',
      title: 'Interação positiva',
      description: 'Brincou com o grupo.',
      eventDate: new Date('2026-08-19T12:00:00.000Z'),
      status: 'PUBLICADO',
      createdBy: 'user-1',
      tags: ['social'],
    });

    expect(prisma.childEvidence.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { sourceType_sourceId_childId: { sourceType: 'DIARY_EVENT', sourceId: 'diary-1', childId: 'child-1' } },
      create: expect.objectContaining({
        evidenceType: 'COMPORTAMENTO',
        sensitivity: 'ORDINARIA',
        visibility: 'PEDAGOGICA',
        content: expect.stringContaining('Brincou com o grupo.'),
      }),
    }));
  });

  it('classifica saúde e visibilidade de uma evidência sensível', async () => {
    const service = new EvidenceService(prisma);

    await service.syncNutrition({
      id: 'nutrition-1',
      childId: 'child-1',
      mantenedoraId: 'tenant-1',
      unitId: 'unit-1',
      motivoAcompanhamento: 'Alergia alimentar',
      statusCaso: 'ATENCAO_ALTA',
      criadoEm: new Date('2026-08-19T12:00:00.000Z'),
      criadoPorId: 'user-1',
    });

    expect(prisma.childEvidence.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        sensitivity: EvidenceSensitivity.SAUDE,
        visibility: EvidenceVisibility.GESTAO,
      }),
    }));
  });

  it('cruza frequência e alertas sem inferir diagnóstico', async () => {
    const service = new EvidenceService(prisma);
    prisma.childEvidence.findMany.mockResolvedValue([
      {
        id: 'a', childId: 'child-1', sourceType: 'ATTENDANCE', evidenceType: 'PRESENCA',
        capturedAt: new Date('2026-08-10T12:00:00.000Z'), structuredData: { status: 'PRESENTE' },
      },
      {
        id: 'b', childId: 'child-1', sourceType: 'ATTENDANCE', evidenceType: 'FREQUENCIA',
        capturedAt: new Date('2026-08-11T12:00:00.000Z'), structuredData: { status: 'AUSENTE' },
      },
      {
        id: 'c', childId: 'child-1', sourceType: 'ALERTA_OPERACIONAL', evidenceType: 'ALERTA_DERIVADO',
        capturedAt: new Date('2026-08-12T12:00:00.000Z'), structuredData: { severidade: 'ALTA' },
      },
    ]);

    const result = await service.crossAnalysis('child-1', {}, user);

    expect(result.totalEvidence).toBe(3);
    expect(result.attendance.rate).toBe(50);
    expect(result.alerts).toEqual({ total: 1, altas: 1, criticas: 0 });
    expect(result.governance.diagnosticInference).toBe(false);
  });

  it('aplica a janela de 90 dias no resumo antes de analisar o histórico', async () => {
    const service = new EvidenceService(prisma);
    const recente = {
      id: 'recent', childId: 'child-1', sourceType: 'DIARY_EVENT', evidenceType: 'COMPORTAMENTO',
      capturedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), structuredData: {},
    };
    const antigo = {
      id: 'old', childId: 'child-1', sourceType: 'DIARY_EVENT', evidenceType: 'COMPORTAMENTO',
      capturedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), structuredData: {},
    };
    prisma.childEvidence.findMany.mockImplementation(async ({ where }: any) => {
      const start = where.capturedAt?.gte?.getTime?.() ?? 0;
      const end = where.capturedAt?.lte?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
      return [recente, antigo].filter((item) => item.capturedAt.getTime() >= start && item.capturedAt.getTime() <= end);
    });

    const result = await service.summary('child-1', user);
    const query = prisma.childEvidence.findMany.mock.calls.at(-1)?.[0];

    expect(query.where.capturedAt.gte).toBeInstanceOf(Date);
    expect(query.where.capturedAt.lte).toBeInstanceOf(Date);
    expect(query.where.capturedAt.lte.getTime() - query.where.capturedAt.gte.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
    expect(result.total).toBe(1);
    expect(result.timeline.map((item: any) => item.id)).toEqual(['recent']);
  });
});
