import { ForbiddenException } from '@nestjs/common';
import { RoleLevel, RoleType } from '@prisma/client';
import { CareService } from './care.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

function user(level: RoleLevel, overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    email: 'user@example.com',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-1',
    roles: [{ roleId: 'role-1', level, type: RoleType.PROFESSOR, unitScopes: [] }],
    ...overrides,
  };
}

function baseChild(overrides: Record<string, unknown> = {}) {
  return {
    id: 'child-1',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-1',
    firstName: 'Ana',
    lastName: 'Silva',
    dateOfBirth: new Date('2022-01-01T00:00:00.000Z'),
    bloodType: null,
    allergies: 'Amendoim',
    medicalConditions: null,
    medicationNeeds: null,
    enrollments: [],
    dietaryRestrictions: [],
    developmentObs: [],
    acompanhamentosNutricionais: [],
    alertasAluno: [],
    atendimentosPais: [],
    developmentReports: [],
    ...overrides,
  };
}

describe('CareService', () => {
  it('bloqueia criança de outra mantenedora', async () => {
    const prisma = {
      child: { findUnique: jest.fn().mockResolvedValue(baseChild({ mantenedoraId: 'mantenedora-2' })) },
    };
    const service = new CareService(prisma as any);

    await expect(service.getChildOverview('child-1', user(RoleLevel.DEVELOPER))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia professor sem vínculo com a turma ativa da criança', async () => {
    const prisma = {
      child: {
        findUnique: jest.fn().mockResolvedValue(baseChild({
          enrollments: [{
            classroomId: 'classroom-1',
            classroom: { id: 'classroom-1', name: 'Berçário A', code: 'B1', unitId: 'unit-1' },
          }],
        })),
      },
      classroomTeacher: { findFirst: jest.fn().mockResolvedValue(null) },
      userRoleUnitScope: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CareService(prisma as any);

    await expect(service.getChildOverview('child-1', user(RoleLevel.PROFESSOR))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('retorna visão minimizada e somente leitura para perfil privilegiado', async () => {
    const prisma = {
      child: {
        findUnique: jest.fn().mockResolvedValue(baseChild({
          developmentObs: [{
            id: 'obs-1', category: 'GERAL', date: new Date('2026-08-01T12:00:00.000Z'),
            behaviorDescription: 'Participou da roda', socialInteraction: null, emotionalState: null,
            motorSkills: null, cognitiveSkills: null, languageSkills: null, learningProgress: 'Em evolução',
            interests: 'Música', challenges: null, recommendations: null, nextSteps: null,
            psychologicalNotes: 'Acompanhar', healthNotes: 'Sem intercorrência', dietaryNotes: null,
          }],
          alertasAluno: [{
            id: 'alert-1', tipo: 'DESENVOLVIMENTO', status: 'ATIVO', titulo: 'Acompanhar',
            descricao: 'Revisar registro', geradoEm: new Date('2026-08-01T12:00:00.000Z'),
            lidoEm: null, resolvidoEm: null,
          }],
        })),
      },
    };
    const service = new CareService(prisma as any);

    const result = await service.getChildOverview('child-1', user(RoleLevel.DEVELOPER));

    expect(result.child.id).toBe('child-1');
    expect(result.development).toHaveLength(1);
    expect(result.alerts).toHaveLength(1);
    expect(result.governance).toMatchObject({ readOnly: true, sensitiveFieldsMinimized: false });
  });
});
