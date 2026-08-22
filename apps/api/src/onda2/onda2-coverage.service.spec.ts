import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Onda2ApprovalStatus, Onda2RatioState, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2CoverageService } from './onda2-coverage.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user-1@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};
const reviewer = { ...actor, sub: 'user-2', email: 'user-2@test.local' };
const publisher = { ...actor, sub: 'user-3', email: 'user-3@test.local' };

const uniqueViolation = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });

describe('Onda2CoverageService', () => {
  const prisma = {
    ratioPolicy: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    ratioSnapshot: { create: jest.fn(), findMany: jest.fn() },
    ratioBreach: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    staffingAssignment: { findUnique: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    facilitySpace: { findFirst: jest.fn() },
    operationalPresenceEvent: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    $transaction: jest.fn((operation: any) => operation(prisma)),
  } as any;
  const access = { assertFlagAndCapability: jest.fn(), assertUnitAccess: jest.fn() } as any;
  let service: Onda2CoverageService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagAndCapability.mockResolvedValue(undefined);
    access.assertUnitAccess.mockResolvedValue(undefined);
    service = new Onda2CoverageService(prisma, access);
  });

  it('calcula snapshot a partir de eventos reais e abre breach quando faltam adultos', async () => {
    prisma.facilitySpace.findFirst.mockResolvedValue({ id: 'space-1', capacity: 20 });
    prisma.operationalPresenceEvent.findMany.mockResolvedValue([
      ...Array.from({ length: 12 }, (_, index) => ({ subjectType: 'CHILD', subjectId: `child-${index + 1}`, eventType: 'CHECK_IN', occurredAt: new Date('2026-08-21T08:00:00.000Z') })),
      { subjectType: 'STAFF', subjectId: 'adult-1', eventType: 'CHECK_IN', occurredAt: new Date('2026-08-21T08:01:00.000Z') },
    ]);
    prisma.ratioPolicy.findFirst.mockResolvedValue({ id: 'policy-1', version: 1, definition: { maxChildrenPerAdult: 6, minimumAdults: 0 } });
    prisma.ratioSnapshot.create.mockResolvedValue({ id: 'snapshot-1', state: Onda2RatioState.VIOLATION });
    prisma.ratioBreach.findFirst.mockResolvedValue(null);
    prisma.ratioBreach.create.mockResolvedValue({ id: 'breach-1' });

    await expect(service.createSnapshot({ unitId: 'unit-1', spaceId: 'space-1', snapshotAt: '2026-08-21T12:00:00.000Z', policyId: 'policy-1' }, actor)).resolves.toEqual({ id: 'snapshot-1', state: Onda2RatioState.VIOLATION });

    expect(prisma.ratioSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ childCount: 12, requiredAdults: 2, validAdults: 1, state: Onda2RatioState.VIOLATION, inputSnapshot: expect.objectContaining({ source: 'operational_presence_event', eventCount: 13, diagnosticInference: false, humanReviewRequired: true }) }) }));
    expect(prisma.ratioBreach.create).toHaveBeenCalled();
  });

  it('retorna UNKNOWN quando a política publicada não está vigente na data do snapshot', async () => {
    prisma.facilitySpace.findFirst.mockResolvedValue({ id: 'space-1', capacity: 20 });
    prisma.operationalPresenceEvent.findMany.mockResolvedValue([]);
    prisma.ratioPolicy.findFirst.mockResolvedValue(null);
    prisma.ratioSnapshot.create.mockResolvedValue({ id: 'snapshot-unknown', state: Onda2RatioState.UNKNOWN });

    await expect(service.createSnapshot({ unitId: 'unit-1', spaceId: 'space-1', snapshotAt: '2026-08-21T12:00:00.000Z', policyId: 'expired-policy' }, actor)).resolves.toEqual({ id: 'snapshot-unknown', state: Onda2RatioState.UNKNOWN });
    expect(prisma.ratioBreach.create).not.toHaveBeenCalled();
  });

  it('rejeita vigência de política com fim anterior ao início', async () => {
    await expect(service.createRatioPolicy({ unitId: 'unit-1', name: 'Regra sintética', effectiveFrom: '2026-08-22T00:00:00.000Z', effectiveTo: '2026-08-21T00:00:00.000Z', definition: { maxChildrenPerAdult: 6 } } as any, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ratioPolicy.create).not.toHaveBeenCalled();
  });

  it('impede o autor de revisar a própria política', async () => {
    prisma.ratioPolicy.findFirst.mockResolvedValue({ id: 'policy-1', unitId: 'unit-1', status: Onda2ApprovalStatus.DRAFT, createdBy: actor.sub });
    await expect(service.reviewRatioPolicy('policy-1', { status: Onda2ApprovalStatus.APPROVED } as any, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ratioPolicy.update).not.toHaveBeenCalled();
  });

  it('permite revisão por ator diferente e persiste o revisor', async () => {
    prisma.ratioPolicy.findFirst.mockResolvedValue({ id: 'policy-1', unitId: 'unit-1', status: Onda2ApprovalStatus.DRAFT, createdBy: actor.sub });
    prisma.ratioPolicy.update.mockResolvedValue({ id: 'policy-1', status: Onda2ApprovalStatus.APPROVED, reviewedBy: reviewer.sub });
    await expect(service.reviewRatioPolicy('policy-1', { status: Onda2ApprovalStatus.APPROVED } as any, reviewer)).resolves.toMatchObject({ reviewedBy: reviewer.sub });
    expect(prisma.ratioPolicy.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: Onda2ApprovalStatus.APPROVED, reviewedBy: reviewer.sub } }));
  });

  it('impede revisar uma política que já foi publicada', async () => {
    prisma.ratioPolicy.findFirst.mockResolvedValue({ id: 'policy-1', unitId: 'unit-1', status: Onda2ApprovalStatus.PUBLISHED, createdBy: actor.sub });
    await expect(service.reviewRatioPolicy('policy-1', { status: Onda2ApprovalStatus.APPROVED } as any, reviewer)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige publicador diferente de autor e revisor', async () => {
    prisma.ratioPolicy.findFirst.mockResolvedValue({ id: 'policy-1', unitId: 'unit-1', status: Onda2ApprovalStatus.APPROVED, createdBy: actor.sub, reviewedBy: reviewer.sub });
    await expect(service.publishRatioPolicy('policy-1', reviewer)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.publishRatioPolicy('policy-1', actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ratioPolicy.update).not.toHaveBeenCalled();
  });

  it('publica política somente com três atores distintos', async () => {
    prisma.ratioPolicy.findFirst.mockResolvedValue({ id: 'policy-1', unitId: 'unit-1', status: Onda2ApprovalStatus.APPROVED, createdBy: actor.sub, reviewedBy: reviewer.sub });
    prisma.ratioPolicy.update.mockResolvedValue({ id: 'policy-1', status: Onda2ApprovalStatus.PUBLISHED, publishedBy: publisher.sub });
    await expect(service.publishRatioPolicy('policy-1', publisher)).resolves.toMatchObject({ publishedBy: publisher.sub });
    expect(prisma.ratioPolicy.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publishedBy: publisher.sub }) }));
  });

  it('rejeita funcionário inativo ou fora da organização/unidade', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.createStaffingAssignment({ unitId: 'unit-1', spaceId: 'space-1', employeeId: 'inactive-or-other-tenant', functionLabel: 'Apoio sintético', startsAt: '2026-08-21T08:00:00.000Z', endsAt: '2026-08-21T12:00:00.000Z' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.staffingAssignment.create).not.toHaveBeenCalled();
  });

  it('rejeita intervalo inválido antes de consultar o banco', async () => {
    await expect(service.createStaffingAssignment({ unitId: 'unit-1', spaceId: 'space-1', employeeId: 'employee-1', functionLabel: 'Apoio sintético', startsAt: '2026-08-21T12:00:00.000Z', endsAt: '2026-08-21T08:00:00.000Z' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejeita conflito de escala no mesmo espaço', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'employee-1' });
    prisma.staffingAssignment.findFirst.mockResolvedValue({ id: 'existing-assignment' });
    await expect(service.createStaffingAssignment({ unitId: 'unit-1', spaceId: 'space-1', employeeId: 'employee-1', functionLabel: 'Apoio sintético', startsAt: '2026-08-21T08:00:00.000Z', endsAt: '2026-08-21T12:00:00.000Z' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.staffingAssignment.create).not.toHaveBeenCalled();
  });

  it('transforma corrida de idempotência em conflito, sem duplicar o registro', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'employee-1' });
    prisma.staffingAssignment.findFirst.mockResolvedValue(null);
    let createCalls = 0;
    prisma.staffingAssignment.create.mockImplementation(async () => {
      createCalls += 1;
      if (createCalls === 1) return { id: 'assignment-1', source: 'MOBILE', idempotencyKey: 'same-key' };
      throw uniqueViolation();
    });
    const dto = { unitId: 'unit-1', spaceId: 'space-1', employeeId: 'employee-1', functionLabel: 'Apoio sintético', startsAt: '2026-08-21T08:00:00.000Z', endsAt: '2026-08-21T12:00:00.000Z', source: 'MOBILE', idempotencyKey: 'same-key' };
    const results = await Promise.allSettled([service.createStaffingAssignment(dto, actor), service.createStaffingAssignment(dto, actor)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected' && item.reason instanceof ConflictException)).toHaveLength(1);
    expect(createCalls).toBe(2);
  });

  it('impede que o autor publique a própria alocação', async () => {
    prisma.staffingAssignment.findFirst.mockResolvedValue({ id: 'assignment-1', unitId: 'unit-1', createdBy: actor.sub });
    await expect(service.publishStaffingAssignment('assignment-1', actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.staffingAssignment.update).not.toHaveBeenCalled();
  });
});
