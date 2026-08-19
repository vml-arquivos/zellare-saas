import { DevelopmentObservationsService } from './development-observations.service';

type MockPrisma = {
  classroom: { findMany: jest.Mock };
  classroomTeacher: { findMany: jest.Mock };
  developmentObservation: { findMany: jest.Mock; create: jest.Mock; count: jest.Mock };
  diaryEvent: { findMany: jest.Mock };
};

function createPrisma(): MockPrisma {
  return {
    classroom: { findMany: jest.fn() },
    classroomTeacher: { findMany: jest.fn() },
    developmentObservation: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
    diaryEvent: { findMany: jest.fn() },
  };
}

const professor = {
  sub: 'teacher-1',
  mantenedoraId: 'mantenedora-1',
  unitId: 'unit-1',
  roles: [{ level: 'PROFESSOR' }],
} as any;

describe('DevelopmentObservationsService — integração Diário → Desenvolvimento', () => {
  it('lista evento do Diário junto com observação formal e identifica a origem', async () => {
    const prisma = createPrisma();
    prisma.classroomTeacher.findMany.mockResolvedValue([{ classroomId: 'class-1' }]);
    prisma.classroom.findMany.mockResolvedValue([
      { id: 'class-1', name: 'Maternal', unit: { id: 'unit-1', name: 'Unidade Piloto' } },
    ]);
    prisma.developmentObservation.findMany.mockResolvedValue([
      {
        id: 'obs-1',
        childId: 'child-1',
        classroomId: 'class-1',
        createdBy: 'teacher-1',
        category: 'COMPORTAMENTO',
        date: new Date('2026-08-18T10:00:00.000Z'),
        behaviorDescription: 'Participou da roda de conversa.',
        developmentAlerts: null,
        recommendations: null,
        nextSteps: null,
        child: { id: 'child-1', firstName: 'Ana', lastName: 'Silva', photoUrl: null },
      },
    ]);
    prisma.diaryEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        childId: 'child-1',
        classroomId: 'class-1',
        type: 'DESENVOLVIMENTO',
        title: 'Interação social',
        description: 'Brincou e colaborou com os colegas.',
        eventDate: new Date('2026-08-19T10:00:00.000Z'),
        createdAt: new Date('2026-08-19T10:01:00.000Z'),
        status: 'PUBLICADO',
        observations: null,
        developmentNotes: null,
        behaviorNotes: null,
        child: { id: 'child-1', firstName: 'Ana', lastName: 'Silva', photoUrl: null },
        classroom: { id: 'class-1', name: 'Maternal', unit: { id: 'unit-1', name: 'Unidade Piloto' } },
        createdByUser: { id: 'teacher-1', firstName: 'Larissa', lastName: 'Vieira', email: 'teacher@example.com' },
      },
    ]);

    const service = new DevelopmentObservationsService(prisma as any);
    const result = await service.listar({ childId: 'child-1', limit: '20' }, professor);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'diary:event-1',
      source: 'DiaryEvent',
      category: 'DESENVOLVIMENTO',
      content: 'Brincou e colaborou com os colegas.',
      child: { name: 'Ana Silva' },
      classroom: { name: 'Maternal' },
      unitName: 'Unidade Piloto',
    });
    expect(result[1]).toMatchObject({ id: 'obs-1', source: 'DevelopmentObservation' });
  });

  it('inclui evidências do Diário no resumo individual sem criar DevelopmentObservation', async () => {
    const prisma = createPrisma();
    prisma.classroomTeacher.findMany.mockResolvedValue([{ classroomId: 'class-1' }]);
    prisma.classroom.findMany.mockResolvedValue([]);
    prisma.developmentObservation.findMany.mockResolvedValue([]);
    prisma.diaryEvent.findMany.mockResolvedValue([
      {
        id: 'event-2',
        childId: 'child-1',
        classroomId: 'class-1',
        type: 'COMPORTAMENTO',
        title: 'Convivência',
        description: 'Compartilhou materiais.',
        eventDate: new Date('2026-08-19T10:00:00.000Z'),
        createdAt: new Date('2026-08-19T10:01:00.000Z'),
        status: 'PUBLICADO',
        child: { id: 'child-1', firstName: 'Ana', lastName: 'Silva', photoUrl: null },
        classroom: { id: 'class-1', name: 'Maternal', unit: { id: 'unit-1', name: 'Unidade Piloto' } },
        createdByUser: null,
      },
    ]);

    const service = new DevelopmentObservationsService(prisma as any);
    const result = await service.resumoAluno('child-1', professor);

    expect(result.total).toBe(1);
    expect(result.porCategoria).toEqual({ COMPORTAMENTO: 1 });
    expect(result.ultimas[0]).toMatchObject({ source: 'DiaryEvent', sourceId: 'event-2' });
    expect(prisma.developmentObservation.create).not.toHaveBeenCalled();
  });
});
