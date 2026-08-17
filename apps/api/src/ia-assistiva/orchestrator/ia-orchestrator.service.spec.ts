import { ForbiddenException } from '@nestjs/common';
import { RoleLevel, RoleType } from '@prisma/client';
import { IaOrchestratorService } from './ia-orchestrator.service';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

function makeUser(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    email: 'teacher@example.com',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-1',
    roles: [
      {
        roleId: 'role-1',
        level: RoleLevel.PROFESSOR,
        type: RoleType.PROFESSOR,
        unitScopes: [],
      },
    ],
    ...overrides,
  };
}

function makeService() {
  const prisma = {
    iaRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    iaResponse: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    iaLog: { create: jest.fn() },
    iaFeedback: { create: jest.fn() },
    userRoleUnitScope: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const executor = { execute: jest.fn() };
  const promptService = { findOne: jest.fn() };

  return {
    service: new IaOrchestratorService(
      prisma as any,
      executor as any,
      promptService as any,
    ),
    prisma,
  };
}

describe('IaOrchestratorService — escopo e governança', () => {
  it('bloqueia leitura de requisição em outra unidade', async () => {
    const { service, prisma } = makeService();
    prisma.iaRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      mantenedoraId: 'mantenedora-1',
      unitId: 'unit-2',
      response: null,
      logs: [],
    });

    await expect(service.findOne('request-1', makeUser())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia listagem com filtro de unidade fora do escopo', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.findAll(
        { mantenedoraId: 'mantenedora-1', unitId: 'unit-2', page: 1, limit: 20 },
        makeUser(),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.iaRequest.findMany).not.toHaveBeenCalled();
  });

  it('bloqueia solicitação quando a mantenedora do corpo não corresponde ao JWT', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.solicitar(
        {
          requesterId: 'user-1',
          mantenedoraId: 'mantenedora-2',
          unitId: 'unit-1',
          type: 'TEXTO_PERSONALIZADO',
          payload: {},
          prompt: 'Gerar um rascunho.',
        },
        makeUser(),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.iaRequest.create).not.toHaveBeenCalled();
  });

  it('permite listagem na própria unidade e mantém o contrato paginado', async () => {
    const { service, prisma } = makeService();
    prisma.iaRequest.findMany.mockResolvedValue([]);
    prisma.iaRequest.count.mockResolvedValue(0);

    await expect(
      service.findAll(
        { mantenedoraId: 'mantenedora-1', unitId: 'unit-1', page: 1, limit: 20 },
        makeUser(),
      ),
    ).resolves.toEqual({ items: [], total: 0, page: 1, limit: 20 });
    expect(prisma.iaRequest.findMany).toHaveBeenCalledTimes(1);
  });
});
