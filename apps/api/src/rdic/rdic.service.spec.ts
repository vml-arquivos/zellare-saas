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


const mantenedoraAdmin = {
  sub: 'admin-1',
  mantenedoraId: 'mantenedora-1',
  roles: [{ level: 'MANTENEDORA', type: 'MANTENEDORA_ADMIN' }],
} as any;

function createProfilePrisma() {
  return {
    rdicDocumentProfile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    mantenedora: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    unit: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('RdicService.perfisDocumentais', () => {
  it('lista perfis curados e garante os dois perfis-base sem dados simulados de documentos', async () => {
    const prisma = createProfilePrisma();
    prisma.rdicDocumentProfile.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.rdicDocumentProfile.create
      .mockResolvedValueOnce({ id: 'seed-df', code: 'SEEDF_RDIC_1_CICLO', version: 1, status: 'ATIVO' })
      .mockResolvedValueOnce({ id: 'seed-generic', code: 'ZELARE_RELATORIO_DESCRITIVO_INFANTIL', version: 1, status: 'ATIVO' });
    prisma.rdicDocumentProfile.findMany.mockResolvedValue([]);

    const result = await new RdicService(prisma as any).listarPerfis(mantenedoraAdmin);

    expect(result).toEqual([]);
    expect(prisma.rdicDocumentProfile.create).toHaveBeenCalledTimes(2);
    expect(prisma.rdicDocumentProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ATIVO',
        OR: expect.arrayContaining([
          { mantenedoraId: 'mantenedora-1' },
          { mantenedoraId: null, isCurated: true },
        ]),
      }),
    }));
  });

  it('bloqueia professor de criar perfil normativo da mantenedora', async () => {
    const prisma = createProfilePrisma();
    const service = new RdicService(prisma as any);

    await expect(service.criarPerfil({
      code: 'PRIVADO',
      name: 'Perfil privado',
      documentLabel: 'Relatório',
      institutionType: 'PRIVADA',
      periodicity: 'SEMESTRAL',
    }, professor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.rdicDocumentProfile.create).not.toHaveBeenCalled();
  });

  it('clona um perfil curado para a mantenedora como perfil próprio não curado', async () => {
    const prisma = createProfilePrisma();
    prisma.rdicDocumentProfile.findFirst.mockResolvedValue({
      id: 'seed-df',
      code: 'SEEDF_RDIC_1_CICLO',
      name: 'RDIC DF',
      documentLabel: 'RDIC',
      institutionType: 'PUBLICA',
      authorityName: 'SEEDF',
      authorityReference: 'SEEDF',
      curriculumReference: 'Currículo DF',
      sourceUrl: 'https://example.gov.br/rdic',
      version: 1,
      periodicity: 'SEMESTRAL',
      requiredFields: [],
      signaturePolicy: {},
      familyPolicy: {},
      archivePolicy: {},
      templateSchema: {},
    });
    prisma.rdicDocumentProfile.create.mockResolvedValue({ id: 'custom-1', isCurated: false });

    const result = await new RdicService(prisma as any).clonarPerfil('seed-df', mantenedoraAdmin);

    expect(result).toEqual({ id: 'custom-1', isCurated: false });
    expect(prisma.rdicDocumentProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mantenedoraId: 'mantenedora-1', isCurated: false, version: 1 }),
    }));
  });

  it('define perfil na mantenedora ou em unidade pertencente ao mesmo tenant', async () => {
    const prisma = createProfilePrisma();
    prisma.rdicDocumentProfile.findFirst.mockResolvedValue({ id: 'profile-1', version: 2, status: 'ATIVO' });
    prisma.mantenedora.update.mockResolvedValue({ id: 'mantenedora-1' });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.unit.update.mockResolvedValue({ id: 'unit-1' });
    const service = new RdicService(prisma as any);

    await expect(service.definirPerfilPadrao({ profileId: 'profile-1' }, mantenedoraAdmin)).resolves.toEqual({
      scope: 'MANTENEDORA', profileId: 'profile-1', profileVersion: 2,
    });
    await expect(service.definirPerfilPadrao({ profileId: 'profile-1', unitId: 'unit-1' }, mantenedoraAdmin)).resolves.toEqual({
      scope: 'UNIT', unitId: 'unit-1', profileId: 'profile-1', profileVersion: 2,
    });
    expect(prisma.mantenedora.update).toHaveBeenCalled();
    expect(prisma.unit.update).toHaveBeenCalledWith({ where: { id: 'unit-1' }, data: { rdicProfileId: 'profile-1' } });
  });
});


function createGovernancePrisma() {
  const instance = {
    id: 'rdic-1',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-1',
    childId: 'child-1',
    status: 'PUBLICADO',
    profileSnapshot: {
      archivePolicy: { required: true },
    },
    signatureManifest: {},
  };
  const prisma: any = {
    rDIXInstancia: {
      findUnique: jest.fn().mockResolvedValue(instance),
      update: jest.fn().mockResolvedValue({ ...instance, status: 'ARQUIVADO' }),
    },
    rdicDocumentEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'event-1', eventType: 'PUBLICADO' }]),
    },
    childGuardian: {
      findFirst: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma));
  return { prisma, instance };
}

describe('RdicService.governancaDocumental', () => {
  it('registra ciência familiar somente com vínculo e consentimento de desenvolvimento', async () => {
    const { prisma } = createGovernancePrisma();
    prisma.childGuardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    const service = new RdicService(prisma);

    await service.registrarCienciaFamilia(
      'rdic-1',
      { sub: 'family-1', mantenedoraId: 'mantenedora-1', roles: [{ level: 'FAMILIA' }] } as any,
    );

    expect(prisma.childGuardian.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ childId: 'child-1', userId: 'family-1', canViewDevelopment: true }),
    }));
    expect(prisma.rDIXInstancia.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ familyAcknowledgedById: 'family-1' }),
    }));
    expect(prisma.rdicDocumentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'CIENCIA_FAMILIA' }),
    }));
  });

  it('impede arquivamento quando o perfil exige ciência familiar ausente', async () => {
    const { prisma } = createGovernancePrisma();
    const service = new RdicService(prisma);

    await expect(service.arquivar(
      'rdic-1',
      { sub: 'unit-1', mantenedoraId: 'mantenedora-1', unitId: 'unit-1', roles: [{ level: 'UNIDADE' }] } as any,
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rDIXInstancia.update).not.toHaveBeenCalled();
  });

  it('consulta a trilha documental em ordem cronológica e no escopo da mantenedora', async () => {
    const { prisma } = createGovernancePrisma();
    const service = new RdicService(prisma);

    await expect(service.eventos(
      'rdic-1',
      { sub: 'admin-1', mantenedoraId: 'mantenedora-1', roles: [{ level: 'MANTENEDORA' }] } as any,
    )).resolves.toEqual([{ id: 'event-1', eventType: 'PUBLICADO' }]);
    expect(prisma.rdicDocumentEvent.findMany).toHaveBeenCalledWith({
      where: { instanciaId: 'rdic-1', mantenedoraId: 'mantenedora-1' },
      orderBy: { createdAt: 'asc' },
    });
  });
});
