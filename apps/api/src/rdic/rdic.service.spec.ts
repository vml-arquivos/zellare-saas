import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RdicService } from './rdic.service';

type MockPrisma = {
  child: { findFirst: jest.Mock };
  classroom: { findFirst: jest.Mock };
  classroomTeacher: { findFirst: jest.Mock };
  enrollment: { findMany: jest.Mock };
  diaryEvent: { findMany: jest.Mock };
  developmentObservation: { findMany: jest.Mock };
};

function createPrisma(): MockPrisma {
  return {
    child: { findFirst: jest.fn() },
    classroom: { findFirst: jest.fn() },
    classroomTeacher: { findFirst: jest.fn() },
    enrollment: { findMany: jest.fn() },
    diaryEvent: { findMany: jest.fn() },
    developmentObservation: { findMany: jest.fn() },
  };
}

const professor = {
  sub: 'teacher-1',
  mantenedoraId: 'mantenedora-1',
  roles: [{ level: 'PROFESSOR' }],
} as any;

const child = {
  id: 'child-1',
  firstName: 'Ana',
  lastName: 'Silva',
  enrollments: [{ classroom: { id: 'class-1', name: 'Maternal' } }],
};

describe('RdicService.resumoExpress', () => {
  it('agrega cobertura e sinais por criança no resumo express da turma', async () => {
    const prisma = createPrisma();
    prisma.classroom.findFirst.mockResolvedValue({ id: 'class-1', name: 'Maternal', unitId: 'unit-1' });
    prisma.enrollment.findMany.mockResolvedValue([
      { child: { id: 'child-1', firstName: 'Ana', lastName: 'Silva' } },
      { child: { id: 'child-2', firstName: 'Bia', lastName: 'Souza' } },
    ]);
    prisma.diaryEvent.findMany.mockResolvedValue([
      {
        childId: 'child-1',
        eventDate: new Date('2026-04-10T10:00:00.000Z'),
        aiContext: { microgestos: [{ microgestoId: 'EXPRESSAO_ORAL', nivel: 'ALCANCADO' }] },
      },
    ]);
    prisma.developmentObservation.findMany.mockResolvedValue([
      { childId: 'child-1', developmentAlerts: null },
    ]);

    const service = new RdicService(prisma as any);
    const result = await service.turmaResumoExpress(
      { classroomId: 'class-1', startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-04-30T23:59:59.999Z' },
      { sub: 'coord-1', mantenedoraId: 'mantenedora-1', unitId: 'unit-1', roles: [{ level: 'UNIDADE' }] } as any,
    );

    expect(result.cobertura).toEqual({ comRegistros: 1, semRegistros: 1, percentual: 50 });
    expect(result.totalMicrogestos).toBe(1);
    expect(result.criancas[0]).toMatchObject({ childId: 'child-1', tendencia: 'FAVORAVEL', microgestos: 1 });
    expect(result.criancas[1]).toMatchObject({ childId: 'child-2', tendencia: 'SEM_DADOS' });
  });

  it('retorna resumo vazio para turma sem matrículas sem consultar eventos', async () => {
    const prisma = createPrisma();
    prisma.classroom.findFirst.mockResolvedValue({ id: 'class-1', name: 'Maternal', unitId: 'unit-1' });
    prisma.enrollment.findMany.mockResolvedValue([]);

    const service = new RdicService(prisma as any);
    const result = await service.turmaResumoExpress(
      { classroomId: 'class-1' },
      { sub: 'coord-1', mantenedoraId: 'mantenedora-1', unitId: 'unit-1', roles: [{ level: 'UNIDADE' }] } as any,
    );

    expect(result.totalCriancas).toBe(0);
    expect(result.cobertura.percentual).toBe(0);
    expect(prisma.diaryEvent.findMany).not.toHaveBeenCalled();
  });

  it('bloqueia professor sem vínculo ativo no resumo da turma', async () => {
    const prisma = createPrisma();
    prisma.classroom.findFirst.mockResolvedValue({ id: 'class-1', name: 'Maternal', unitId: 'unit-1' });
    prisma.classroomTeacher.findFirst.mockResolvedValue(null);
    const service = new RdicService(prisma as any);

    await expect(service.turmaResumoExpress(
      { classroomId: 'class-1' },
      { sub: 'teacher-1', mantenedoraId: 'mantenedora-1', unitId: 'unit-1', roles: [{ level: 'PROFESSOR' }] } as any,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it('agrega microgestos e observações reais em um diagnóstico determinístico', async () => {
    const prisma = createPrisma();
    prisma.child.findFirst.mockResolvedValue(child);
    prisma.classroomTeacher.findFirst.mockResolvedValue({ classroomId: 'class-1' });
    prisma.diaryEvent.findMany.mockResolvedValue([
      {
        eventDate: new Date('2026-04-10T10:00:00.000Z'),
        aiContext: {
          microgestos: [
            { microgestoId: 'EXPRESSAO_ORAL', nivel: 'ALCANCADO' },
            { microgestoId: 'AUTOCONTROLE', nivel: 'EM_DESENVOLVIMENTO' },
          ],
        },
      },
      {
        eventDate: new Date('2026-04-11T10:00:00.000Z'),
        aiContext: { microgestos: [{ microgestoId: 'EXPRESSAO_ORAL', nivel: 'ALCANCADO' }] },
      },
    ]);
    prisma.developmentObservation.findMany.mockResolvedValue([
      { date: new Date('2026-04-11T12:00:00.000Z'), category: 'LINGUAGEM', developmentAlerts: null, recommendations: 'Continuar rodas de conversa' },
    ]);

    const service = new RdicService(prisma as any);
    const result = await service.resumoExpress(
      'child-1',
      { startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-04-30T23:59:59.999Z' },
      professor,
    );

    expect(result.fontes).toEqual({
      diariosPublicados: 2,
      observacoesDesenvolvimento: 1,
      diasComRegistro: 2,
      microgestos: 3,
    });
    expect(result.porNivel).toEqual({ ALCANCADO: 2, EM_DESENVOLVIMENTO: 1 });
    expect(result.habilidades[0]).toMatchObject({ microgestoId: 'EXPRESSAO_ORAL', ocorrencias: 2 });
    expect(result.tendencia).toBe('FAVORAVEL');
    expect(prisma.diaryEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        childId: 'child-1',
        mantenedoraId: 'mantenedora-1',
        status: { in: ['PUBLICADO', 'REVISADO', 'ARQUIVADO'] },
      }),
    }));
  });

  it('retorna estado vazio sem inventar sinais ou alertas', async () => {
    const prisma = createPrisma();
    prisma.child.findFirst.mockResolvedValue(child);
    prisma.classroomTeacher.findFirst.mockResolvedValue({ classroomId: 'class-1' });
    prisma.diaryEvent.findMany.mockResolvedValue([]);
    prisma.developmentObservation.findMany.mockResolvedValue([]);

    const service = new RdicService(prisma as any);
    const result = await service.resumoExpress('child-1', {}, professor);

    expect(result.tendencia).toBe('SEM_DADOS');
    expect(result.fontes.microgestos).toBe(0);
    expect(result.pontosAtencao).toEqual([]);
    expect(result.proximosPassos).toHaveLength(1);
  });

  it('bloqueia papel de unidade fora da própria unidade', async () => {
    const prisma = createPrisma();
    prisma.child.findFirst.mockResolvedValue({
      ...child,
      enrollments: [{ classroom: { id: 'class-1', name: 'Maternal', unitId: 'unit-other' } }],
    });
    const service = new RdicService(prisma as any);
    const unitUser = { sub: 'unit-user', mantenedoraId: 'mantenedora-1', unitId: 'unit-1', roles: [{ level: 'UNIDADE' }] } as any;

    await expect(service.resumoExpress('child-1', {}, unitUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.diaryEvent.findMany).not.toHaveBeenCalled();
  });

  it('bloqueia professor sem vínculo ativo com a turma da criança', async () => {
    const prisma = createPrisma();
    prisma.child.findFirst.mockResolvedValue(child);
    prisma.classroomTeacher.findFirst.mockResolvedValue(null);

    const service = new RdicService(prisma as any);

    await expect(service.resumoExpress('child-1', {}, professor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.diaryEvent.findMany).not.toHaveBeenCalled();
  });

  it('rejeita período invertido ou maior que 366 dias', async () => {
    const prisma = createPrisma();
    prisma.child.findFirst.mockResolvedValue(child);
    prisma.classroomTeacher.findFirst.mockResolvedValue({ classroomId: 'class-1' });
    const service = new RdicService(prisma as any);

    await expect(service.resumoExpress(
      'child-1',
      { startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-04-01T00:00:00.000Z' },
      professor,
    )).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.resumoExpress(
      'child-1',
      { startDate: '2025-01-01T00:00:00.000Z', endDate: '2026-06-01T00:00:00.000Z' },
      professor,
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não revela criança fora da mantenedora', async () => {
    const prisma = createPrisma();
    prisma.child.findFirst.mockResolvedValue(null);
    const service = new RdicService(prisma as any);

    await expect(service.resumoExpress('other-child', {}, professor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.classroomTeacher.findFirst).not.toHaveBeenCalled();
  });
});
