import { AlertasService } from './alertas.service';

function makeService(eventCount: number, existingAlert: unknown = null, developmentEvents: unknown[] = []) {
  const prisma = {
    classroom: {
      findMany: jest.fn().mockResolvedValue([{
        id: 'class-1',
        name: 'Berçário 1',
        unitId: 'unit-1',
        unit: { mantenedoraId: 'mant-1' },
        _count: { enrollments: 8 },
      }]),
    },
    diaryEvent: {
      count: jest.fn().mockResolvedValue(eventCount),
      findMany: jest.fn().mockResolvedValue(developmentEvents),
    },
    alertaOperacional: {
      findFirst: jest.fn().mockResolvedValue(existingAlert),
      create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      update: jest.fn().mockResolvedValue({ id: 'alert-1' }),
    },
  };
  return { prisma, service: new AlertasService(prisma as any) };
}

describe('AlertasService.analisarCoberturaDiario', () => {

  it('cria pendência operacional quando a turma não tem diário no dia', async () => {
    const { prisma, service } = makeService(0);

    await service.analisarCoberturaDiario();

    expect(prisma.diaryEvent.count).toHaveBeenCalledTimes(1);
    expect(prisma.alertaOperacional.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        childId: '',
        classroomId: 'class-1',
        tipo: 'AUSENCIA_REGISTRO_DIARIO',
        severidade: 'MEDIA',
        metadados: expect.objectContaining({
          regra: 'COBERTURA_DIARIO_TURMA',
          alunosAtivos: 8,
          eventosEncontrados: 0,
        }),
      }),
    }));
  });

  it('atualiza a pendência aberta em vez de duplicar o alerta', async () => {
    const { prisma, service } = makeService(0, { id: 'alert-existing' });

    await service.analisarCoberturaDiario();

    expect(prisma.alertaOperacional.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'alert-existing' } }));
    expect(prisma.alertaOperacional.create).not.toHaveBeenCalled();
  });

  it('não cria alerta quando existe evento real no diário', async () => {
    const { prisma, service } = makeService(2);

    await service.analisarCoberturaDiario();

    expect(prisma.alertaOperacional.findFirst).not.toHaveBeenCalled();
    expect(prisma.alertaOperacional.create).not.toHaveBeenCalled();
  });
});

describe('AlertasService.analisarMicrogestos', () => {
  it('agrega recorrência estruturada e cria sinal explicável de acompanhamento', async () => {
    const events = Array.from({ length: 3 }, (_, index) => ({
      id: `event-${index}`,
      childId: 'child-1',
      classroomId: 'class-1',
      eventDate: new Date(`2026-08-${10 + index}T10:00:00.000Z`),
      aiContext: {
        structuredObservation: {
          source: 'daily-collection',
          domain: 'REGULACAO_EMOCIONAL',
          indicatorId: 'ADAPTACAO_ROTINA',
          level: 'REQUER_ATENCAO',
          context: index === 0 ? 'TRANSICAO' : 'RODA',
          opportunity: 'OBSERVADA',
          teacherConcern: index === 2,
          abc: { intensity: 2 },
        },
      },
      child: { id: 'child-1', firstName: 'Ana', lastName: 'Teste' },
      classroom: {
        id: 'class-1',
        name: 'Turma A',
        unitId: 'unit-1',
        unit: { mantenedoraId: 'mant-1' },
      },
    }));
    const { prisma, service } = makeService(0, null, events);

    await service.analisarMicrogestos();

    expect(prisma.diaryEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.alertaOperacional.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        childId: 'child-1',
        tipo: 'OUTRO',
        severidade: 'MEDIA',
        titulo: expect.stringContaining('padrão de acompanhamento'),
        descricao: expect.stringContaining('não é diagnóstico'),
        metadados: expect.objectContaining({
          regra: 'DESENVOLVIMENTO_ESTRUTURADO_REGULACAO_EMOCIONAL',
          observacoesAtencao: 3,
          contextos: expect.arrayContaining(['TRANSICAO', 'RODA']),
        }),
      }),
    }));
  });

  it('ignora registros sem oportunidade de observação', async () => {
    const { prisma, service } = makeService(0, null, [{
      id: 'event-no-opportunity',
      childId: 'child-1',
      classroomId: 'class-1',
      eventDate: new Date(),
      aiContext: {
        structuredObservation: {
          source: 'daily-collection',
          domain: 'LINGUAGEM_COMUNICACAO',
          indicatorId: 'EXPRESSAO_ORAL',
          level: 'REQUER_ATENCAO',
          opportunity: 'NAO_HOUVE_OPORTUNIDADE',
        },
      },
      child: { id: 'child-1', firstName: 'Ana', lastName: 'Teste' },
      classroom: { id: 'class-1', name: 'Turma A', unitId: 'unit-1', unit: { mantenedoraId: 'mant-1' } },
    }]);

    await service.analisarMicrogestos();

    expect(prisma.alertaOperacional.create).not.toHaveBeenCalled();
  });
});
