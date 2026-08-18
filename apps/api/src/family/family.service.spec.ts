import { RoleLevel, RoleType } from '@prisma/client';
import { FamilyService } from './family.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

function familyUser(): JwtPayload {
  return {
    sub: 'guardian-1',
    email: 'family@example.com',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-1',
    roles: [{
      roleId: 'family-role',
      level: RoleLevel.FAMILIA,
      type: RoleType.FAMILIA_RESPONSAVEL,
      unitScopes: [],
    }],
  };
}

function makePrisma(canViewDevelopment: boolean) {
  const child = {
    id: 'child-1',
    firstName: 'Ana',
    lastName: 'Silva',
    photoUrl: null,
    unitId: 'unit-1',
    mantenedoraId: 'mantenedora-1',
  };
  return {
    child: { findFirst: jest.fn().mockResolvedValue(child) },
    childGuardian: {
      findFirst: jest.fn().mockResolvedValue({
        childId: 'child-1',
        userId: 'guardian-1',
        revokedAt: null,
        canViewTimeline: true,
        canViewDevelopment,
      }),
    },
    diaryEvent: { findMany: jest.fn().mockResolvedValue([]) },
    studentPostPerformance: { findMany: jest.fn().mockResolvedValue([]) },
    developmentObservation: {
      findMany: jest.fn().mockResolvedValue(canViewDevelopment ? [{
        id: 'observation-1',
        category: 'GERAL',
        date: new Date('2026-08-01T12:00:00.000Z'),
        learningProgress: 'Evolução observada',
        socialInteraction: null,
        emotionalState: null,
        recommendations: null,
      }] : []),
    },
    familyCommunication: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('FamilyService — privacy timeline', () => {
  it('não consulta nem expõe observações sem permissão de desenvolvimento', async () => {
    const prisma = makePrisma(false);
    const service = new FamilyService(prisma as any);

    const result = await service.timeline('child-1', {}, familyUser());

    expect(prisma.developmentObservation.findMany).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.privacy).toMatchObject({ familyDataFiltered: true, healthDataVisible: false, developmentVisible: false });
  });

  it('inclui observações filtradas quando o responsável possui consentimento explícito', async () => {
    const prisma = makePrisma(true);
    const service = new FamilyService(prisma as any);

    const result = await service.timeline('child-1', {}, familyUser());

    expect(prisma.developmentObservation.findMany).toHaveBeenCalledTimes(1);
    expect(result.privacy).toMatchObject({ developmentVisible: true, healthDataVisible: false });
    expect(result.items).toEqual([
      expect.objectContaining({ kind: 'OBSERVACAO', title: 'Observação · GERAL' }),
    ]);
  });
});
