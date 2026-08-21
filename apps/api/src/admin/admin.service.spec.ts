import { ForbiddenException } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService — escopo de atualização de usuário', () => {
  function makePrisma() {
    const tx = {
      user: {
        update: jest.fn().mockResolvedValue({
          id: 'target',
          email: 'target@example.com',
          firstName: 'Target',
          lastName: 'User',
          unitId: 'unit-a',
          status: 'ATIVO',
        }),
      },
    };
    return {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as any;
  }

  const unidadeActor = {
    sub: 'actor',
    email: 'actor@example.com',
    mantenedoraId: 'mantenedora-1',
    unitId: 'unit-a',
    roles: [{ level: RoleLevel.UNIDADE, type: 'UNIDADE_COORDENADOR_PEDAGOGICO' }],
  } as any;

  it('bloqueia perfil de unidade ao editar usuário de outra unidade', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      mantenedoraId: 'mantenedora-1',
      unitId: 'unit-b',
      email: 'target@example.com',
    });
    const service = new AdminService(prisma);

    await expect(service.updateUser(unidadeActor, 'target', { status: 'INATIVO' as any }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('permite perfil de unidade atualizar usuário da própria unidade', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      mantenedoraId: 'mantenedora-1',
      unitId: 'unit-a',
      email: 'target@example.com',
    });
    const service = new AdminService(prisma);

    const result = await service.updateUser(unidadeActor, 'target', { status: 'INATIVO' as any });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.user.id).toBe('target');
  });
});
