import { AlertasService } from './alertas.service';

describe('AlertasService.analisarCoberturaDiario', () => {
  function makeService(eventCount: number, existingAlert: unknown = null) {
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
      diaryEvent: { count: jest.fn().mockResolvedValue(eventCount) },
      alertaOperacional: {
        findFirst: jest.fn().mockResolvedValue(existingAlert),
        create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
        update: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      },
    };
    return { prisma, service: new AlertasService(prisma as any) };
  }

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
