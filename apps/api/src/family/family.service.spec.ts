import { RoleLevel, RoleType } from '@prisma/client';
import { FamilyService } from './family.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

function familyUser(): JwtPayload {
  return {
    sub: 'guardian-1',
    email: 'family@example.invalid',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-1',
    roles: [{ roleId: 'family-role', level: RoleLevel.FAMILIA, type: RoleType.FAMILIA_RESPONSAVEL, unitScopes: [] }],
  };
}

function staffUser(): JwtPayload {
  return {
    sub: 'staff-1',
    email: 'staff@example.invalid',
    mantenedoraId: 'mantenedora-1',
    unitId: undefined,
    roles: [{ roleId: 'staff-role', level: RoleLevel.STAFF_CENTRAL, type: RoleType.STAFF_CENTRAL_PEDAGOGICO, unitScopes: ['unit-1'] }],
  };
}

function unitUser(): JwtPayload {
  return {
    sub: 'unit-1-user',
    email: 'unit@example.invalid',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-1',
    roles: [{ roleId: 'unit-role', level: RoleLevel.UNIDADE, type: RoleType.UNIDADE_COORDENADOR_PEDAGOGICO, unitScopes: [] }],
  };
}

function makePrisma(canViewDevelopment: boolean) {
  const child = { id: 'child-1', firstName: 'Ana', lastName: 'Silva', photoUrl: null, unitId: 'unit-1', mantenedoraId: 'mantenedora-1' };
  return {
    child: { findFirst: jest.fn().mockResolvedValue(child), count: jest.fn(), findMany: jest.fn() },
    childGuardian: {
      findFirst: jest.fn().mockResolvedValue({ childId: 'child-1', userId: 'guardian-1', revokedAt: null, canViewTimeline: true, canViewDevelopment }),
      findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), upsert: jest.fn(),
    },
    diaryEvent: { findMany: jest.fn().mockResolvedValue([]) },
    studentPostPerformance: { findMany: jest.fn().mockResolvedValue([]) },
    developmentObservation: { findMany: jest.fn().mockResolvedValue(canViewDevelopment ? [{ id: 'observation-1', category: 'GERAL', date: new Date('2026-08-01T12:00:00.000Z'), learningProgress: 'Evolução observada', socialInteraction: null, emotionalState: null, recommendations: null }] : []) },
    familyCommunication: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
    classroom: { findFirst: jest.fn().mockResolvedValue({ id: 'class-1', unitId: 'unit-1' }) },
    user: { findFirst: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
}

function makeCrudPrisma() {
  const base = makePrisma(true) as any;
  const tx = {
    childGuardian: base.childGuardian,
    auditLog: base.auditLog,
  };
  base.$transaction = jest.fn(async (operation: unknown) => typeof operation === 'function' ? operation(tx) : Promise.all(operation as Promise<unknown>[]));
  return base;
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
    expect(result.items).toEqual([expect.objectContaining({ kind: 'OBSERVACAO', title: 'Observação · GERAL' })]);
  });
});

describe('FamilyService — Gate UX 0.4', () => {
  it('aplica filtros server-side e retorna matrícula ativa e paginação', async () => {
    const prisma = makeCrudPrisma();
    prisma.child.count.mockResolvedValue(21);
    prisma.child.findMany.mockResolvedValue([{ id: 'child-1', firstName: 'Ana', lastName: 'Silva', photoUrl: null, unitId: 'unit-1', unit: { id: 'unit-1', name: 'Unidade A', code: 'A' }, enrollments: [{ id: 'enroll-1', enrollmentDate: new Date('2026-02-01'), classroom: { id: 'class-1', name: 'Maternal A', code: 'MA', unitId: 'unit-1' } }] }]);
    const service = new FamilyService(prisma as any);
    const result = await service.listChildren(unitUser(), { unitId: 'unit-1', classroomId: 'class-1', search: 'Ana', page: 2, limit: 10, sortBy: 'firstName', sortOrder: 'asc' } as any);
    expect(result.pagination).toMatchObject({ page: 2, limit: 10, total: 21, totalPages: 3, hasNext: true });
    expect(result.items[0]).toMatchObject({ unit: { code: 'A' }, activeEnrollment: { classroom: { id: 'class-1' } } });
    expect(prisma.classroom.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'class-1' }) }));
  });

  it('lista somente contas familiares ativas e elegíveis com paginação', async () => {
    const prisma = makeCrudPrisma();
    prisma.user.count.mockResolvedValue(2);
    prisma.user.findMany.mockResolvedValue([{ id: 'guardian-2', firstName: 'Bruno', lastName: 'Silva', email: 'bruno@example.invalid', phone: null, status: 'ATIVO', unit: { id: 'unit-1', name: 'Unidade A', code: 'A' } }]);
    const service = new FamilyService(prisma as any);
    const result = await service.listGuardianCandidates(unitUser(), { unitId: 'unit-1', search: 'bruno', page: 1, limit: 1 } as any);
    expect(result.items).toHaveLength(1);
    expect(result.pagination).toMatchObject({ total: 2, totalPages: 2, hasNext: true });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'ATIVO', unitId: 'unit-1' }) }));
  });

  it('registra consentimentos, evita duplicidade e audita ator/data no vínculo', async () => {
    const prisma = makeCrudPrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'guardian-2', firstName: 'Bruno', lastName: 'Silva', email: 'bruno@example.invalid', phone: null, status: 'ATIVO' });
    prisma.childGuardian.findUnique.mockResolvedValue({ id: 'link-old' });
    prisma.childGuardian.upsert.mockResolvedValue({ id: 'link-1', childId: 'child-1', userId: 'guardian-2', relationship: 'Pai', isPrimary: true, canViewTimeline: true, canViewDevelopment: true, canViewHealth: false, user: { id: 'guardian-2' } });
    const service = new FamilyService(prisma as any);
    const result = await service.linkGuardian('child-1', { userId: 'guardian-2', relationship: 'Pai', isPrimary: true, canViewTimeline: true, canViewDevelopment: true, canViewHealth: false }, unitUser());
    expect(result).toMatchObject({ isPrimary: true, canViewDevelopment: true, canViewHealth: false });
    expect(prisma.childGuardian.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { childId_userId: { childId: 'child-1', userId: 'guardian-2' } } }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'unit-1-user', action: 'UPDATE', entityId: 'child-1' }) }));
  });

  it('revoga imediatamente permissões e registra auditoria', async () => {
    const prisma = makeCrudPrisma();
    prisma.childGuardian.updateMany.mockResolvedValue({ count: 1 });
    const service = new FamilyService(prisma as any);
    await service.revokeGuardian('child-1', 'guardian-2', unitUser());
    expect(prisma.childGuardian.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date), canViewTimeline: false, canViewDevelopment: false, canViewHealth: false }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
