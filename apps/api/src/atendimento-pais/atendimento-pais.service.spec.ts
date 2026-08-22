import { RoleLevel, StatusAtendimento } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AtendimentoPaisService } from './atendimento-pais.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const professor: JwtPayload = {
  sub: 'prof-1',
  email: 'prof@example.invalid',
  mantenedoraId: 'org-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'r1', level: RoleLevel.PROFESSOR, type: 'PROFESSOR' as any, unitScopes: [] }],
};

const coordinator: JwtPayload = {
  sub: 'coord-1',
  email: 'coord@example.invalid',
  mantenedoraId: 'org-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'r2', level: RoleLevel.UNIDADE, type: 'UNIDADE_COORDENADOR_PEDAGOGICO' as any, unitScopes: [] }],
};

function makePrisma() {
  const prisma: any = {
    unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
    child: { findFirst: jest.fn().mockResolvedValue({ id: 'child-1', unitId: 'unit-1' }) },
    classroom: { findFirst: jest.fn().mockResolvedValue({ id: 'class-1', unitId: 'unit-1' }) },
    classroomTeacher: { findFirst: jest.fn().mockResolvedValue({ id: 'link-1' }) },
    atendimentoPais: { count: jest.fn().mockResolvedValue(26), findMany: jest.fn().mockResolvedValue([{ id: 'attendance-1' }]), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  };
  prisma.$transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));
  return prisma;
}

describe('AtendimentoPaisService — Gate UX 0.4', () => {
  it('rejeita intervalo invertido antes da consulta ao banco', async () => {
    const prisma = makePrisma();
    const service = new AtendimentoPaisService(prisma, { syncSafely: jest.fn(), syncAtendimentoPais: jest.fn() } as any);
    await expect(service.listar(coordinator, { startDate: '2026-08-20', endDate: '2026-08-01' } as any)).rejects.toThrow(BadRequestException);
    expect(prisma.atendimentoPais.count).not.toHaveBeenCalled();
  });

  it('aplica paginação e filtros de status no servidor', async () => {
    const prisma = makePrisma();
    const service = new AtendimentoPaisService(prisma, { syncSafely: jest.fn(), syncAtendimentoPais: jest.fn() } as any);
    const result = await service.listar(coordinator, { status: StatusAtendimento.REALIZADO, page: 3, limit: 10 } as any);
    expect(result.pagination).toMatchObject({ page: 3, limit: 10, total: 26, totalPages: 3, hasNext: false });
    expect(prisma.atendimentoPais.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10, where: expect.objectContaining({ status: StatusAtendimento.REALIZADO }) }));
  });

  it('mantém professor limitado às crianças das próprias turmas', async () => {
    const prisma = makePrisma();
    const service = new AtendimentoPaisService(prisma, { syncSafely: jest.fn(), syncAtendimentoPais: jest.fn() } as any);
    await service.listar(professor, { classroomId: 'class-1' } as any);
    expect(prisma.classroomTeacher.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ classroomId: 'class-1', teacherId: 'prof-1' }) }));
    expect(prisma.atendimentoPais.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ child: expect.objectContaining({ AND: expect.arrayContaining([expect.objectContaining({ enrollments: expect.anything() })]) }) }) }));
  });

  it('bloqueia unidade de outra organização ou fora do escopo', async () => {
    const prisma = makePrisma();
    prisma.unit.findFirst.mockResolvedValue(null);
    const service = new AtendimentoPaisService(prisma, { syncSafely: jest.fn(), syncAtendimentoPais: jest.fn() } as any);
    await expect(service.listar(coordinator, { unitId: 'unit-other' } as any)).rejects.toThrow(ForbiddenException);
    expect(prisma.atendimentoPais.count).not.toHaveBeenCalled();
  });

  it('propaga falha transacional sem retornar sucesso falso', async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockRejectedValue(new Error('rollback')); 
    const service = new AtendimentoPaisService(prisma, { syncSafely: jest.fn(), syncAtendimentoPais: jest.fn() } as any);
    await expect(service.listar(coordinator, {} as any)).rejects.toThrow('rollback');
  });
});
