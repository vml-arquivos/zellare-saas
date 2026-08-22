import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogAction, AuditLogEntity, FamilyCommunicationStatus, Prisma, RoleLevel, RoleType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFamilyMessageDto,
  CreateGuardianLinkDto,
  FamilyChildrenQueryDto,
  FamilyGuardianCandidatesQueryDto,
  FamilyQueryDto,
  FamilyTimelineQueryDto,
} from './dto/family.dto';
import { EvidenceService } from '../evidence/evidence.service';

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceService?: EvidenceService,
  ) {}

  private roleLevels(user: JwtPayload) {
    return user.roles?.map((role) => role.level) || [];
  }

  private hasLevel(user: JwtPayload, ...levels: RoleLevel[]) {
    return this.roleLevels(user).some((level) => levels.includes(level));
  }

  private isFamily(user: JwtPayload) {
    return user.roles?.some((role) => role.type === RoleType.FAMILIA_RESPONSAVEL || role.level === RoleLevel.FAMILIA) ?? false;
  }

  private isProfessor(user: JwtPayload) {
    return this.hasLevel(user, RoleLevel.PROFESSOR);
  }

  private unitScopeIds(user: JwtPayload): string[] | null {
    if (this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA)) return null;
    const centralScopes = user.roles
      .filter((role) => role.level === RoleLevel.STAFF_CENTRAL)
      .flatMap((role) => role.unitScopes || []);
    if (centralScopes.length > 0) return [...new Set(centralScopes)];
    if (this.hasLevel(user, RoleLevel.STAFF_CENTRAL)) return null;
    return user.unitId ? [user.unitId] : [];
  }

  private async assertUnitScope(user: JwtPayload, unitId: string) {
    if (!user.mantenedoraId) throw new ForbiddenException('Escopo de mantenedora ausente');
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, mantenedoraId: user.mantenedoraId, isActive: true },
      select: { id: true },
    });
    if (!unit) throw new ForbiddenException('Unidade fora do escopo da mantenedora');
    const allowedUnitIds = this.unitScopeIds(user);
    if (allowedUnitIds && !allowedUnitIds.includes(unitId)) throw new ForbiddenException('Unidade fora do escopo do usuário');
    return unit.id;
  }

  private async scopedChildWhere(user: JwtPayload, query: FamilyChildrenQueryDto): Promise<Prisma.ChildWhereInput> {
    if (!user.mantenedoraId) throw new ForbiddenException('Escopo de mantenedora ausente');
    const where: Prisma.ChildWhereInput = {
      mantenedoraId: user.mantenedoraId,
      isActive: true,
    };

    if (this.isFamily(user)) {
      where.guardianLinks = { some: { userId: user.sub, revokedAt: null, canViewTimeline: true } };
    } else {
      const allowedUnitIds = this.unitScopeIds(user);
      if (query.unitId) {
        await this.assertUnitScope(user, query.unitId);
        where.unitId = query.unitId;
      } else if (allowedUnitIds) {
        where.unitId = { in: allowedUnitIds };
      }
      if (this.isProfessor(user)) {
        where.enrollments = {
          some: {
            status: 'ATIVA',
            classroom: { teachers: { some: { teacherId: user.sub, isActive: true } } },
          },
        };
      }
    }

    if (query.classroomId) {
      const classroom = await this.prisma.classroom.findFirst({
        where: {
          id: query.classroomId,
          isActive: true,
          unit: { mantenedoraId: user.mantenedoraId },
        },
        select: { id: true, unitId: true },
      });
      if (!classroom) throw new NotFoundException('Turma não encontrada no escopo');
      await this.assertUnitScope(user, classroom.unitId);
      if (this.isProfessor(user)) {
        const teacherLink = await this.prisma.classroomTeacher.findFirst({
          where: { classroomId: classroom.id, teacherId: user.sub, isActive: true },
          select: { id: true },
        });
        if (!teacherLink) throw new ForbiddenException('Professor sem acesso a esta turma');
      }
      where.enrollments = { some: { classroomId: classroom.id, status: 'ATIVA' } };
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async activeGuardian(user: JwtPayload, childId: string, permission: 'timeline' | 'development' = 'timeline') {
    if (!this.isFamily(user)) return null;
    const link = await this.prisma.childGuardian.findFirst({
      where: {
        childId,
        userId: user.sub,
        revokedAt: null,
        ...(permission === 'timeline' ? { canViewTimeline: true } : { canViewDevelopment: true }),
      },
    });
    if (!link) throw new ForbiddenException('Criança não vinculada ao responsável ou permissão revogada');
    return link;
  }

  private async assertChildScope(user: JwtPayload, childId: string, permission: 'timeline' | 'development' = 'timeline') {
    if (!user.mantenedoraId) throw new ForbiddenException('Escopo de mantenedora ausente');
    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        mantenedoraId: user.mantenedoraId,
        isActive: true,
        ...(this.isFamily(user) ? { guardianLinks: { some: { userId: user.sub, revokedAt: null, canViewTimeline: true } } } : {}),
        ...(!this.isFamily(user) && this.isProfessor(user)
          ? { enrollments: { some: { status: 'ATIVA', classroom: { teachers: { some: { teacherId: user.sub, isActive: true } } } } } }
          : {}),
      },
    });
    if (!child) throw new NotFoundException('Criança não encontrada no escopo');
    if (this.isFamily(user)) {
      await this.activeGuardian(user, childId, permission);
    } else {
      const allowedUnitIds = this.unitScopeIds(user);
      if (allowedUnitIds && !allowedUnitIds.includes(child.unitId)) throw new ForbiddenException('Criança fora do escopo do usuário');
      await this.assertUnitScope(user, child.unitId);
    }
    return child;
  }

  async listChildren(user: JwtPayload, query: FamilyChildrenQueryDto) {
    const where = await this.scopedChildWhere(user, query);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const orderBy = query.sortBy === 'createdAt'
      ? { createdAt: query.sortOrder }
      : [{ [query.sortBy]: query.sortOrder }, { lastName: 'asc' }];

    const [total, children] = await this.prisma.$transaction([
      this.prisma.child.count({ where }),
      this.prisma.child.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          unitId: true,
          unit: { select: { id: true, name: true, code: true } },
          enrollments: {
            where: { status: 'ATIVA' },
            orderBy: { enrollmentDate: 'desc' },
            take: 1,
            select: {
              id: true,
              enrollmentDate: true,
              classroom: { select: { id: true, name: true, code: true, unitId: true } },
            },
          },
          ...(this.isFamily(user) ? { guardianLinks: { where: { userId: user.sub, revokedAt: null }, select: { relationship: true, isPrimary: true } } } : {}),
        },
        orderBy: orderBy as Prisma.ChildOrderByWithRelationInput | Prisma.ChildOrderByWithRelationInput[],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items = children.map((child) => {
      const enrollment = child.enrollments[0] || null;
      const link = 'guardianLinks' in child ? child.guardianLinks[0] : undefined;
      return {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        photoUrl: child.photoUrl,
        unitId: child.unitId,
        unit: child.unit,
        activeEnrollment: enrollment,
        relationship: link?.relationship,
        isPrimary: link?.isPrimary,
      };
    });

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total },
    };
  }

  async listGuardianCandidates(user: JwtPayload, query: FamilyGuardianCandidatesQueryDto) {
    if (!this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL, RoleLevel.UNIDADE)) {
      throw new ForbiddenException('Perfil sem permissão para listar responsáveis');
    }
    if (!user.mantenedoraId) throw new ForbiddenException('Escopo de mantenedora ausente');
    const allowedUnitIds = this.unitScopeIds(user);
    if (query.unitId) await this.assertUnitScope(user, query.unitId);
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      mantenedoraId: user.mantenedoraId,
      status: 'ATIVO',
      ...(query.unitId ? { unitId: query.unitId } : allowedUnitIds ? { unitId: { in: allowedUnitIds } } : {}),
      roles: { some: { isActive: true, role: { isActive: true, type: RoleType.FAMILIA_RESPONSAVEL } } },
      ...(search ? { OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const page = query.page || 1;
    const limit = query.limit || 25;
    const orderBy = query.sortBy === 'createdAt'
      ? { createdAt: query.sortOrder }
      : [{ [query.sortBy]: query.sortOrder }, { lastName: 'asc' }];
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, unit: { select: { id: true, name: true, code: true } } },
        orderBy: orderBy as Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total },
    };
  }

  async listGuardians(childId: string, user: JwtPayload) {
    await this.assertChildScope(user, childId);
    if (this.isFamily(user)) throw new ForbiddenException('Somente equipe autorizada pode listar responsáveis');
    const [links, auditEvents] = await this.prisma.$transaction([
      this.prisma.childGuardian.findMany({
        where: { childId, child: { mantenedoraId: user.mantenedoraId } },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } } },
        orderBy: [{ revokedAt: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.auditLog.findMany({
        where: { mantenedoraId: user.mantenedoraId, entity: AuditLogEntity.CHILD, entityId: childId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, action: true, description: true, changes: true, createdAt: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
    ]);
    return links.map((link) => ({
      ...link,
      audit: auditEvents
        .filter((event) => {
          const changes = event.changes;
          return !!changes && typeof changes === 'object' && !Array.isArray(changes) && (changes as Record<string, unknown>).guardianUserId === link.userId;
        })
        .map((event) => ({ id: event.id, action: event.action, description: event.description, occurredAt: event.createdAt, actor: event.user })),
    }));
  }

  async linkGuardian(childId: string, dto: CreateGuardianLinkDto, user: JwtPayload) {
    if (!this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL, RoleLevel.UNIDADE)) {
      throw new ForbiddenException('Perfil sem permissão para vincular responsável');
    }
    const child = await this.assertChildScope(user, childId);
    const guardian = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        mantenedoraId: user.mantenedoraId,
        status: 'ATIVO',
        roles: { some: { isActive: true, role: { isActive: true, type: RoleType.FAMILIA_RESPONSAVEL } } },
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true },
    });
    if (!guardian) throw new NotFoundException('Usuário não é um responsável familiar ativo da mantenedora');

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.childGuardian.findUnique({ where: { childId_userId: { childId: child.id, userId: guardian.id } } });
      if (dto.isPrimary === true) {
        await tx.childGuardian.updateMany({
          where: { childId: child.id, userId: { not: guardian.id }, revokedAt: null, isPrimary: true },
          data: { isPrimary: false, updatedAt: now },
        });
      }
      const link = await tx.childGuardian.upsert({
        where: { childId_userId: { childId: child.id, userId: guardian.id } },
        update: {
          relationship: dto.relationship.trim(),
          isPrimary: dto.isPrimary ?? false,
          canViewTimeline: dto.canViewTimeline ?? true,
          canViewDevelopment: dto.canViewDevelopment ?? false,
          canViewHealth: dto.canViewHealth ?? false,
          consentAt: now,
          revokedAt: null,
          updatedAt: now,
        },
        create: {
          childId: child.id,
          userId: guardian.id,
          relationship: dto.relationship.trim(),
          isPrimary: dto.isPrimary ?? false,
          canViewTimeline: dto.canViewTimeline ?? true,
          canViewDevelopment: dto.canViewDevelopment ?? false,
          canViewHealth: dto.canViewHealth ?? false,
          consentAt: now,
          createdAt: now,
          updatedAt: now,
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } } },
      });
      await tx.auditLog.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: child.unitId,
          userId: user.sub,
          action: existing ? AuditLogAction.UPDATE : AuditLogAction.CREATE,
          entity: AuditLogEntity.CHILD,
          entityId: child.id,
          description: existing ? 'Vínculo familiar atualizado' : 'Vínculo familiar criado',
          changes: { guardianUserId: guardian.id, relationship: link.relationship, isPrimary: link.isPrimary, canViewTimeline: link.canViewTimeline, canViewDevelopment: link.canViewDevelopment, canViewHealth: link.canViewHealth },
        },
      });
      return link;
    });
  }

  async revokeGuardian(childId: string, guardianUserId: string, user: JwtPayload) {
    if (!this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL, RoleLevel.UNIDADE)) {
      throw new ForbiddenException('Perfil sem permissão para revogar responsável');
    }
    const child = await this.assertChildScope(user, childId);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.childGuardian.updateMany({
        where: { childId, userId: guardianUserId, child: { mantenedoraId: user.mantenedoraId }, revokedAt: null },
        data: { revokedAt: now, canViewTimeline: false, canViewDevelopment: false, canViewHealth: false, isPrimary: false, updatedAt: now },
      });
      if (result.count > 0) {
        await tx.auditLog.create({
          data: {
            mantenedoraId: user.mantenedoraId,
            unitId: child.unitId,
            userId: user.sub,
            action: AuditLogAction.PERMISSION_CHANGE,
            entity: AuditLogEntity.CHILD,
            entityId: child.id,
            description: 'Vínculo familiar revogado',
            changes: { guardianUserId, revokedAt: now.toISOString(), permissions: { canViewTimeline: false, canViewDevelopment: false, canViewHealth: false } },
          },
        });
      }
      return result;
    });
  }

  async timeline(childId: string, query: FamilyTimelineQueryDto, user: JwtPayload) {
    const child = await this.assertChildScope(user, childId, 'timeline');
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 90 * 86_400_000);
    const to = query.to ? new Date(query.to) : new Date();
    let familyCanViewDevelopment = true;
    if (this.isFamily(user)) {
      const guardian = await this.prisma.childGuardian.findFirst({ where: { childId, userId: user.sub, revokedAt: null, canViewTimeline: true }, select: { canViewDevelopment: true } });
      familyCanViewDevelopment = guardian?.canViewDevelopment === true;
    }

    const [diaryEvents, posts, observations, messages] = await Promise.all([
      this.prisma.diaryEvent.findMany({ where: { childId, eventDate: { gte: from, lte: to }, ...(this.isFamily(user) ? { status: { in: ['PUBLICADO', 'REVISADO'] } } : {}) }, select: { id: true, type: true, title: true, description: true, observations: true, eventDate: true, mediaUrls: true, status: true }, orderBy: { eventDate: 'desc' } }),
      this.prisma.studentPostPerformance.findMany({ where: { childId, post: { status: 'PUBLICADO', createdAt: { gte: from, lte: to } } }, select: { id: true, performance: true, notes: true, createdAt: true, post: { select: { id: true, title: true, content: true, type: true, createdAt: true, dueDate: true } } }, orderBy: { createdAt: 'desc' } }),
      familyCanViewDevelopment ? this.prisma.developmentObservation.findMany({ where: { childId, date: { gte: from, lte: to }, ...(this.isFamily(user) ? { createdBy: { not: user.sub } } : {}) }, ...(this.isFamily(user) ? { select: { id: true, category: true, date: true, learningProgress: true, socialInteraction: true, emotionalState: true, recommendations: true } } : {}), orderBy: { date: 'desc' } }) : Promise.resolve([]),
      this.listMessages(user, { childId }),
    ]);
    const items = [
      ...diaryEvents.map((event) => ({ id: event.id, kind: 'DIARIO', date: event.eventDate, title: event.title, body: event.description, data: event })),
      ...posts.map((post) => ({ id: post.id, kind: 'POST_TURMA', date: post.createdAt, title: post.post.title, body: post.post.content, data: post })),
      ...observations.map((observation) => ({ id: observation.id, kind: 'OBSERVACAO', date: observation.date, title: `Observação · ${observation.category}`, body: observation.learningProgress || observation.socialInteraction || observation.emotionalState || observation.recommendations || null, data: observation })),
      ...messages.map((message) => ({ id: message.id, kind: 'COMUNICACAO', date: message.createdAt, title: message.subject, body: message.body, data: message })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { child: { id: child.id, firstName: child.firstName, lastName: child.lastName, photoUrl: child.photoUrl }, from, to, privacy: { familyDataFiltered: this.isFamily(user), healthDataVisible: false, developmentVisible: familyCanViewDevelopment }, items };
  }

  async listMessages(user: JwtPayload, query: FamilyQueryDto) {
    const childId = query.childId;
    if (childId) await this.assertChildScope(user, childId);
    const where = this.isFamily(user)
      ? { childId, OR: [{ senderUserId: user.sub }, { recipientUserId: user.sub }], child: { mantenedoraId: user.mantenedoraId } }
      : { childId, unitId: user.unitId && !this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL) ? user.unitId : undefined, child: { mantenedoraId: user.mantenedoraId } };
    return this.prisma.familyCommunication.findMany({ where, include: { sender: { select: { id: true, firstName: true, lastName: true } }, recipient: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async sendMessage(childId: string, dto: CreateFamilyMessageDto, user: JwtPayload) {
    const child = await this.assertChildScope(user, childId);
    let recipientUserId = dto.recipientUserId;
    if (this.isFamily(user)) {
      await this.activeGuardian(user, childId);
      recipientUserId = undefined;
    } else {
      const guardian = await this.prisma.childGuardian.findFirst({ where: { childId, revokedAt: null, ...(recipientUserId ? { userId: recipientUserId } : { isPrimary: true }) }, select: { userId: true } });
      recipientUserId = guardian?.userId;
      if (!recipientUserId) throw new NotFoundException('Nenhum responsável ativo encontrado para receber a mensagem');
    }
    const message = await this.prisma.familyCommunication.create({ data: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId, senderUserId: user.sub, recipientUserId, subject: dto.subject.trim(), body: dto.body.trim(), status: FamilyCommunicationStatus.ENVIADA } });
    await this.evidenceService?.syncSafely('FAMILY_COMMUNICATION', () => this.evidenceService!.syncFamilyCommunication(message));
    return message;
  }

  async markMessageRead(id: string, user: JwtPayload) {
    const message = await this.prisma.familyCommunication.findFirst({ where: { id, child: { mantenedoraId: user.mantenedoraId } } });
    if (!message) throw new NotFoundException('Mensagem não encontrada');
    if (message.recipientUserId !== user.sub) throw new ForbiddenException('Somente o destinatário pode marcar a mensagem como lida');
    return this.prisma.familyCommunication.update({ where: { id }, data: { status: FamilyCommunicationStatus.LIDA, readAt: new Date() } });
  }
}
