import { RoleLevel } from '@prisma/client';
import { AlertasController } from './alertas.controller';

describe('AlertasController — contrato de urgência operacional', () => {
  it('separa urgentes operacionais de acompanhamento sem quebrar o resumo legado', async () => {
    const prisma = {
      alertaOperacional: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'alert-urgent',
            tipo: 'FALTA_CONSECUTIVA',
            severidade: 'ALTA',
            titulo: 'Faltas consecutivas',
            descricao: 'Verificar com a família',
            unitId: 'unit-1',
            classroomId: 'class-1',
            childId: 'child-1',
            criadoEm: new Date('2026-08-21T10:00:00.000Z'),
            metadados: { canal: 'OPERACIONAL', prioridadeOperacional: 'URGENTE' },
          },
          {
            id: 'alert-follow-up',
            tipo: 'OUTRO',
            severidade: 'MEDIA',
            titulo: 'Acompanhamento pedagógico',
            descricao: 'Revisar evidências',
            unitId: 'unit-1',
            classroomId: 'class-1',
            childId: 'child-1',
            criadoEm: new Date('2026-08-21T09:00:00.000Z'),
            metadados: { canal: 'ACOMPANHAMENTO', prioridadeOperacional: 'NORMAL' },
          },
        ]),
      },
    } as any;
    const controller = new AlertasController(prisma);
    const user = {
      sub: 'manager-1',
      mantenedoraId: 'mantenedora-1',
      roles: [{ level: RoleLevel.MANTENEDORA }],
    } as any;

    const result = await controller.listar(user, undefined, undefined, undefined, '50', undefined, undefined);

    expect(result.total).toBe(2);
    expect(result.criticos).toBe(1);
    expect(result.atencao).toBe(1);
    expect(result.urgentes).toHaveLength(1);
    expect(result.urgentes[0].id).toBe('alert-urgent');
    expect(result.acompanhamento).toHaveLength(1);
    expect(result.acompanhamento[0].id).toBe('alert-follow-up');
    expect(result.alertas[0].prioridadeOperacional).toBe('URGENTE');
  });
});
