import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { FamilyCommunicationStatus, RoleLevel, RoleType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyMessageDto, CreateGuardianLinkDto, FamilyQueryDto, FamilyTimelineQueryDto } from './dto/family.dto';
import { EvidenceService } from '../evidence/evidence.service';

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly evidenceService?: EvidenceService,
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

  private canManageNetwork(user: JwtPayload) {
    return this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL);
  }

  private async assertUnitScope(user: JwtPayload, unitId: string) {
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, mantenedoraId: user.mantenedoraId }, select: { id: true } });
    if (!unit) throw new ForbiddenException('Unidade fora do escopo da mantenedora');
    if (!this.canManageNetwork(user) && user.unitId && user.unitId !== unitId) throw new ForbiddenException('Unidade fora do escopo do usuário');
    return unit.id;
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
    const child = await this.prisma.child.findFirst({ where: { id: childId, mantenedoraId: user.mantenedoraId } });
    if (!child) throw new NotFoundException('Criança não encontrada no escopo');
    if (this.isFamily(user)) {
      await this.activeGuardian(user, childId, permission);
    } else if (!this.canManageNetwork(user) && user.unitId && child.unitId !== user.unitId) {
      throw new ForbiddenException('Criança fora da unidade do usuário');
    }
    return child;
  }

  async listChildren(user: JwtPayload) {
    if (this.isFamily(user)) {
      const links = await this.prisma.childGuardian.findMany({
        where: { userId: user.sub, revokedAt: null, canViewTimeline: true, child: { mantenedoraId: user.mantenedoraId } },
        include: { child: { select: { id: true, firstName: true, lastName: true, photoUrl: true, unitId: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return links.map((link) => ({ ...link.child, relationship: link.relationship, isPrimary: link.isPrimary }));
    }
    return this.prisma.child.findMany({
      where: { mantenedoraId: user.mantenedoraId, ...(this.canManageNetwork(user) ? {} : { unitId: user.unitId || '__none__' }) },
      select: { id: true, firstName: true, lastName: true, photoUrl: true, unitId: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async listGuardians(childId: string, user: JwtPayload) {
    await this.assertChildScope(user, childId);
    if (this.isFamily(user)) throw new ForbiddenException('Somente equipe autorizada pode listar responsáveis');
    return this.prisma.childGuardian.findMany({
      where: { childId, child: { mantenedoraId: user.mantenedoraId } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } } },
      orderBy: [{ revokedAt: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
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
        roles: { some: { isActive: true, role: { type: RoleType.FAMILIA_RESPONSAVEL } } },
      },
      select: { id: true },
    });
    if (!guardian) throw new NotFoundException('Usuário não é um responsável familiar ativo da mantenedora');
    return this.prisma.childGuardian.upsert({
      where: { childId_userId: { childId: child.id, userId: guardian.id } },
      update: {
        relationship: dto.relationship.trim(),
        isPrimary: dto.isPrimary ?? false,
        canViewTimeline: dto.canViewTimeline ?? true,
        canViewDevelopment: dto.canViewDevelopment ?? false,
        canViewHealth: dto.canViewHealth ?? false,
        consentAt: new Date(),
        revokedAt: null,
      },
      create: {
        childId: child.id,
        userId: guardian.id,
        relationship: dto.relationship.trim(),
        isPrimary: dto.isPrimary ?? false,
        canViewTimeline: dto.canViewTimeline ?? true,
        canViewDevelopment: dto.canViewDevelopment ?? false,
        canViewHealth: dto.canViewHealth ?? false,
        consentAt: new Date(),
      },
    });
  }

  async revokeGuardian(childId: string, guardianUserId: string, user: JwtPayload) {
    if (!this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL, RoleLevel.UNIDADE)) {
      throw new ForbiddenException('Perfil sem permissão para revogar responsável');
    }
    await this.assertChildScope(user, childId);
    return this.prisma.childGuardian.updateMany({
      where: { childId, userId: guardianUserId, child: { mantenedoraId: user.mantenedoraId }, revokedAt: null },
      data: { revokedAt: new Date(), canViewTimeline: false, canViewDevelopment: false, canViewHealth: false },
    });
  }

  async timeline(childId: string, query: FamilyTimelineQueryDto, user: JwtPayload) {
    const child = await this.assertChildScope(user, childId, 'timeline');
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 90 * 86_400_000);
    const to = query.to ? new Date(query.to) : new Date();
    let familyCanViewDevelopment = true;
    if (this.isFamily(user)) {
      const guardian = await this.prisma.childGuardian.findFirst({
        where: {
          childId,
          userId: user.sub,
          revokedAt: null,
          canViewTimeline: true,
        },
        select: { canViewDevelopment: true },
      });
      familyCanViewDevelopment = guardian?.canViewDevelopment === true;
    }

    const [diaryEvents, posts, observations, messages] = await Promise.all([
      this.prisma.diaryEvent.findMany({
        where: { childId, eventDate: { gte: from, lte: to }, ...(this.isFamily(user) ? { status: { in: ['PUBLICADO', 'REVISADO'] } } : {}) },
        select: { id: true, type: true, title: true, description: true, observations: true, eventDate: true, mediaUrls: true, status: true },
        orderBy: { eventDate: 'desc' },
      }),
      this.prisma.studentPostPerformance.findMany({
        where: { childId, post: { status: 'PUBLICADO', createdAt: { gte: from, lte: to } } },
        select: { id: true, performance: true, notes: true, createdAt: true, post: { select: { id: true, title: true, content: true, type: true, createdAt: true, dueDate: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      familyCanViewDevelopment
        ? this.prisma.developmentObservation.findMany({
            where: {
              childId,
              date: { gte: from, lte: to },
              ...(this.isFamily(user) ? { createdBy: { not: user.sub } } : {}),
            },
            ...(this.isFamily(user)
              ? {
                  select: {
                    id: true,
                    category: true,
                    date: true,
                    learningProgress: true,
                    socialInteraction: true,
                    emotionalState: true,
                    recommendations: true,
                  },
                }
              : {}),
            orderBy: { date: 'desc' },
          })
        : Promise.resolve([]),
      this.listMessages(user, { childId }),
    ]);
    const items = [
      ...diaryEvents.map((event) => ({ id: event.id, kind: 'DIARIO', date: event.eventDate, title: event.title, body: event.description, data: event })),
      ...posts.map((item) => ({ id: item.id, kind: 'POST_TURMA', date: item.createdAt, title: item.post.title, body: item.post.content, data: item })),
      ...observations.map((item) => ({ id: item.id, kind: 'OBSERVACAO', date: item.date, title: `Observação · ${item.category}`, body: item.learningProgress || item.socialInteraction || item.emotionalState || item.recommendations || null, data: item })),
      ...messages.map((message) => ({ id: message.id, kind: 'COMUNICACAO', date: message.createdAt, title: message.subject, body: message.body, data: message })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName, photoUrl: child.photoUrl },
      from,
      to,
      privacy: {
        familyDataFiltered: this.isFamily(user),
        healthDataVisible: false,
        developmentVisible: familyCanViewDevelopment,
      },
      items,
    };
  }

  async listMessages(user: JwtPayload, query: FamilyQueryDto) {
    const childId = query.childId;
    if (childId) await this.assertChildScope(user, childId);
    const where = this.isFamily(user)
      ? { childId, OR: [{ senderUserId: user.sub }, { recipientUserId: user.sub }], child: { mantenedoraId: user.mantenedoraId } }
      : { childId, unitId: user.unitId && !this.canManageNetwork(user) ? user.unitId : undefined, child: { mantenedoraId: user.mantenedoraId } };
    return this.prisma.familyCommunication.findMany({
      where,
      include: { sender: { select: { id: true, firstName: true, lastName: true } }, recipient: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async sendMessage(childId: string, dto: CreateFamilyMessageDto, user: JwtPayload) {
    const child = await this.assertChildScope(user, childId);
    let recipientUserId = dto.recipientUserId;
    if (this.isFamily(user)) {
      const guardian = await this.activeGuardian(user, childId);
      if (!guardian) throw new ForbiddenException('Responsável sem vínculo ativo');
      recipientUserId = undefined;
    } else {
      const guardian = await this.prisma.childGuardian.findFirst({ where: { childId, revokedAt: null, ...(recipientUserId ? { userId: recipientUserId } : { isPrimary: true }) }, select: { userId: true } });
      recipientUserId = guardian?.userId;
      if (!recipientUserId) throw new NotFoundException('Nenhum responsável ativo encontrado para receber a mensagem');
    }
    const message = await this.prisma.familyCommunication.create({
      data: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId, senderUserId: user.sub, recipientUserId, subject: dto.subject.trim(), body: dto.body.trim(), status: FamilyCommunicationStatus.ENVIADA },
    });
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
