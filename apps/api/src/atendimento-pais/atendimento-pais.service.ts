import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleLevel, StatusAtendimento } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAtendimentoDto, ListAtendimentoQueryDto } from './dto/create-atendimento.dto';
import { EvidenceService } from '../evidence/evidence.service';

@Injectable()
export class AtendimentoPaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceService: EvidenceService,
  ) {}

  private hasLevel(user: JwtPayload, ...levels: RoleLevel[]) {
    return user.roles.some((role) => levels.includes(role.level));
  }

  private isProfessor(user: JwtPayload) {
    return this.hasLevel(user, RoleLevel.PROFESSOR);
  }

  private allowedUnitIds(user: JwtPayload): string[] | null {
    if (this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA)) return null;
    const scoped = user.roles.filter((role) => role.level === RoleLevel.STAFF_CENTRAL).flatMap((role) => role.unitScopes || []);
    if (scoped.length > 0) return [...new Set(scoped)];
    if (this.hasLevel(user, RoleLevel.STAFF_CENTRAL)) return null;
    return user.unitId ? [user.unitId] : [];
  }

  private async assertUnitScope(user: JwtPayload, unitId: string) {
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, mantenedoraId: user.mantenedoraId, isActive: true }, select: { id: true } });
    if (!unit) throw new ForbiddenException('Unidade não encontrada ou sem acesso');
    const allowed = this.allowedUnitIds(user);
    if (allowed && !allowed.includes(unitId)) throw new ForbiddenException('Sem acesso a esta unidade');
    return unit.id;
  }

  private async assertChildScope(user: JwtPayload, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        mantenedoraId: user.mantenedoraId,
        isActive: true,
        ...(this.isProfessor(user) ? { enrollments: { some: { status: 'ATIVA', classroom: { teachers: { some: { teacherId: user.sub, isActive: true } } } } } } : {}),
      },
      select: { id: true, unitId: true },
    });
    if (!child) throw new NotFoundException('Criança não encontrada ou sem acesso');
    await this.assertUnitScope(user, child.unitId);
    return child;
  }

  private async assertClassroomScope(user: JwtPayload, classroomId: string) {
    const classroom = await this.prisma.classroom.findFirst({ where: { id: classroomId, isActive: true, unit: { mantenedoraId: user.mantenedoraId } }, select: { id: true, unitId: true } });
    if (!classroom) throw new NotFoundException('Turma não encontrada ou sem acesso');
    await this.assertUnitScope(user, classroom.unitId);
    if (this.isProfessor(user)) {
      const link = await this.prisma.classroomTeacher.findFirst({ where: { classroomId, teacherId: user.sub, isActive: true }, select: { id: true } });
      if (!link) throw new ForbiddenException('Professor sem acesso a esta turma');
    }
    return classroom;
  }

  async criar(dto: CreateAtendimentoDto, user: JwtPayload) {
    if (!user.mantenedoraId) throw new ForbiddenException('Escopo de mantenedora ausente');
    const child = await this.assertChildScope(user, dto.childId);
    const atendimento = await this.prisma.atendimentoPais.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: child.unitId,
        childId: dto.childId,
        responsavelNome: dto.responsavelNome,
        responsavelRelacao: dto.responsavelRelacao,
        responsavelContato: dto.responsavelContato,
        tipo: dto.tipo,
        dataAtendimento: new Date(dto.dataAtendimento),
        atendidoPorId: user.sub,
        assunto: dto.assunto,
        descricao: dto.descricao,
        encaminhamento: dto.encaminhamento,
        retornoNecessario: dto.retornoNecessario ?? false,
        dataRetorno: dto.dataRetorno ? new Date(dto.dataRetorno) : undefined,
      },
      include: { child: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.evidenceService.syncSafely('ATENDIMENTO_PAIS', () => this.evidenceService.syncAtendimentoPais(atendimento));
    return atendimento;
  }

  async listar(user: JwtPayload, filtros: ListAtendimentoQueryDto) {
    if (!user.mantenedoraId) throw new ForbiddenException('Escopo de mantenedora ausente');
    const where: Prisma.AtendimentoPaisWhereInput = { mantenedoraId: user.mantenedoraId };
    const allowedUnitIds = this.allowedUnitIds(user);

    if (filtros.unitId) {
      await this.assertUnitScope(user, filtros.unitId);
      where.unitId = filtros.unitId;
    } else if (allowedUnitIds) {
      where.unitId = { in: allowedUnitIds };
    }

    const childFilters: Prisma.ChildWhereInput[] = [{ mantenedoraId: user.mantenedoraId, isActive: true }];
    if (filtros.childId) {
      await this.assertChildScope(user, filtros.childId);
      childFilters.push({ id: filtros.childId });
    }
    if (filtros.classroomId) {
      const classroom = await this.assertClassroomScope(user, filtros.classroomId);
      childFilters.push({ enrollments: { some: { classroomId: classroom.id, status: 'ATIVA' } } });
    }
    if (this.isProfessor(user)) {
      childFilters.push({ enrollments: { some: { status: 'ATIVA', classroom: { teachers: { some: { teacherId: user.sub, isActive: true } } } } } });
    }
    if (filtros.search?.trim()) {
      const search = filtros.search.trim();
      childFilters.push({ OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ] });
    }
    where.child = { AND: childFilters };
    if (filtros.status) where.status = filtros.status;

    const start = filtros.startDate ? new Date(filtros.startDate) : undefined;
    const end = filtros.endDate ? new Date(filtros.endDate) : undefined;
    if (start && end && start > end) throw new BadRequestException('startDate não pode ser posterior a endDate');
    if (start || end) where.dataAtendimento = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };

    const page = filtros.page || 1;
    const limit = filtros.limit || 25;
    const orderBy = { [filtros.sortBy || 'dataAtendimento']: filtros.sortOrder || 'desc' } as Prisma.AtendimentoPaisOrderByWithRelationInput;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.atendimentoPais.count({ where }),
      this.prisma.atendimentoPais.findMany({
        where,
        include: {
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              enrollments: { where: { status: 'ATIVA' }, take: 1, orderBy: { enrollmentDate: 'desc' }, select: { classroom: { select: { id: true, name: true, code: true, unitId: true } } } },
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total } };
  }

  async atualizarStatus(id: string, status: StatusAtendimento, user: JwtPayload) {
    const atendimento = await this.prisma.atendimentoPais.findFirst({ where: { id, mantenedoraId: user.mantenedoraId }, select: { id: true, childId: true } });
    if (!atendimento) throw new NotFoundException('Atendimento não encontrado');
    await this.assertChildScope(user, atendimento.childId);
    return this.prisma.atendimentoPais.update({ where: { id }, data: { status } });
  }
}
