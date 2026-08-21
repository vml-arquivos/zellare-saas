import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Onda1ConsentDecision,
  Onda1ConsentPurpose,
  Onda1ConversationStatus,
  Onda1MessageStatus,
  Onda1PublicationStatus,
  Onda1ReviewTaskStatus,
  Prisma,
  RoleLevel,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditService } from '../common/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { Onda1AccessService } from './onda1-access.service';
import { ONDA1_CAPABILITIES, ONDA1_FEATURE_FLAGS } from './onda1.constants';
import {
  CreateAcknowledgmentDto,
  CreateConsentGrantDto,
  CreateFamilyContributionDto,
  CreateFamilyConversationDto,
  CreateFamilyMessageDto,
  CreatePublicationDto,
  FamilyFeedQueryDto,
  UpsertCommunicationPreferenceDto,
  UpdateFamilyConversationDto,
} from './dto/onda1.dto';

const FAMILY_READ_ROLES = [
  RoleLevel.PROFESSOR,
  RoleLevel.UNIDADE,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.MANTENEDORA,
  RoleLevel.DEVELOPER,
  RoleLevel.FAMILIA,
];

@Injectable()
export class Onda1FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: Onda1AccessService,
    private readonly audit: AuditService,
  ) {}

  private async assertFlag(user: JwtPayload) {
    await this.access.assertFlagEnabled(user, ONDA1_FEATURE_FLAGS.familyCircleV1);
  }

  private async childInScope(childId: string, user: JwtPayload) {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, mantenedoraId: user.mantenedoraId },
      select: { id: true, unitId: true, firstName: true, lastName: true, photoUrl: true, enrollments: { where: { status: 'ATIVA' }, select: { classroomId: true } } },
    });
    if (!child) throw new NotFoundException('Criança não encontrada no escopo da mantenedora.');
    if (this.access.isNetworkScoped(user) || user.unitId === child.unitId) return child;
    if (this.access.isCentralScoped(user)) {
      const centralRole = user.roles?.find((role) => role.level === RoleLevel.STAFF_CENTRAL);
      const scopes = Array.isArray(centralRole?.unitScopes) ? centralRole.unitScopes : [];
      if (scopes.length === 0 || scopes.includes(child.unitId)) return child;
    }
    if (this.access.isTeacher(user)) {
      const classroomIds = child.enrollments.map((enrollment) => enrollment.classroomId);
      const assigned = await this.prisma.classroomTeacher.findFirst({ where: { teacherId: user.sub, classroomId: { in: classroomIds }, isActive: true }, select: { id: true } });
      if (assigned) return child;
    }
    if (await this.access.canViewFamilyChild(user, childId)) return child;
    throw new ForbiddenException('Criança fora do escopo do usuário.');
  }

  private async conversationInScope(conversationId: string, user: JwtPayload) {
    const conversation = await this.prisma.familyConversation.findFirst({ where: { id: conversationId, mantenedoraId: user.mantenedoraId } });
    if (!conversation) throw new NotFoundException('Conversa não encontrada.');
    await this.childInScope(conversation.childId, user);
    if (user.roles?.some((role) => role.level === RoleLevel.FAMILIA)) {
      const linked = await this.access.canViewFamilyChild(user, conversation.childId);
      if (!linked) throw new ForbiddenException('Família sem vínculo ativo com a criança.');
    }
    return conversation;
  }

  private async outbox(tx: Prisma.TransactionClient, user: JwtPayload, eventType: string, aggregateType: string, aggregateId: string, payload: Prisma.InputJsonValue) {
    await tx.domainOutboxEvent.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        eventType,
        aggregateType,
        aggregateId,
        idempotencyKey: `${eventType}:${aggregateId}`,
        payload,
      },
    });
  }

  private async activeConsent(childId: string, consentGrantId: string | undefined, user: JwtPayload) {
    if (!consentGrantId) throw new ForbiddenException('Publicação familiar exige consentimento explícito.');
    const now = new Date();
    const consent = await this.prisma.consentGrant.findFirst({
      where: {
        id: consentGrantId,
        childId,
        mantenedoraId: user.mantenedoraId,
        decision: Onda1ConsentDecision.CONCEDIDO,
        revokedAt: null,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    });
    if (!consent) throw new ForbiddenException('Consentimento inexistente, revogado ou expirado.');
    return consent;
  }

  async feed(childId: string, query: FamilyFeedQueryDto, user: JwtPayload) {
    await this.assertFlag(user);
    const child = await this.childInScope(childId, user);
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const publicationWhere: Prisma.PublicationRecordWhereInput = {
      mantenedoraId: user.mantenedoraId,
      childId,
      status: Onda1PublicationStatus.PUBLICADA,
      OR: [{ audienceType: 'FAMILIA' }, { audienceUserId: user.sub }],
    };
    const [publicationsPage, conversations, contributions] = await Promise.all([
      this.prisma.publicationRecord.findMany({ where: publicationWhere, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], take: limit + 1, ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}) }),
      this.prisma.familyConversation.findMany({ where: { mantenedoraId: user.mantenedoraId, childId, ...(user.roles?.some((role) => role.level === RoleLevel.FAMILIA) ? {} : {}) }, orderBy: { updatedAt: 'desc' }, take: 30, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
      this.prisma.familyContribution.findMany({ where: { mantenedoraId: user.mantenedoraId, childId, status: Onda1ReviewTaskStatus.APPROVED, visibility: 'FAMILIA_AUTORIZADA' }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    const hasMore = publicationsPage.length > limit;
    const publications = hasMore ? publicationsPage.slice(0, limit) : publicationsPage;
    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName, photoUrl: child.photoUrl },
      publications,
      conversations,
      contributions,
      pageInfo: { hasMore, nextCursor: hasMore ? publications[publications.length - 1]?.id ?? null : null },
      governance: { consentGated: true, sourceSnapshot: true, diagnosticInference: false, humanReviewRequired: true },
    };
  }

  async listConversations(childId: string, user: JwtPayload) {
    await this.assertFlag(user);
    await this.childInScope(childId, user);
    return this.prisma.familyConversation.findMany({ where: { mantenedoraId: user.mantenedoraId, childId }, orderBy: { updatedAt: 'desc' }, take: 100, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  }

  async createConversation(dto: CreateFamilyConversationDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyMessage);
    const child = await this.childInScope(dto.childId, user);
    const conversation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyConversation.create({ data: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId: child.id, subject: dto.subject.trim(), priority: dto.priority, createdBy: user.sub } });
      await this.outbox(tx, user, 'FamilyConversationCreated', 'FamilyConversation', created.id, { conversationId: created.id, childId: child.id });
      return created;
    });
    await this.audit.log({ action: 'CREATE', entity: 'FAMILY_CONVERSATION', entityId: conversation.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId });
    return conversation;
  }

  async updateConversation(conversationId: string, dto: UpdateFamilyConversationDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyPublish);
    const current = await this.conversationInScope(conversationId, user);
    if (current.status === dto.status) return current;
    const updated = await this.prisma.familyConversation.update({ where: { id: conversationId }, data: { status: dto.status, closedBy: dto.status === Onda1ConversationStatus.ENCERRADA ? user.sub : null, closedAt: dto.status === Onda1ConversationStatus.ENCERRADA ? new Date() : null } });
    await this.audit.log({ action: 'UPDATE', entity: 'FAMILY_CONVERSATION', entityId: updated.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: updated.unitId, changes: { status: dto.status } });
    return updated;
  }

  async listMessages(conversationId: string, query: FamilyFeedQueryDto, user: JwtPayload) {
    await this.assertFlag(user);
    await this.conversationInScope(conversationId, user);
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const page = await this.prisma.familyMessageV2.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}) });
    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;
    return { items: items.reverse(), pageInfo: { hasMore, nextCursor: hasMore ? items[0]?.id ?? null : null } };
  }

  async createMessage(conversationId: string, dto: CreateFamilyMessageDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyMessage);
    const conversation = await this.conversationInScope(conversationId, user);
    if (conversation.status !== Onda1ConversationStatus.ABERTA) throw new BadRequestException('A conversa está encerrada.');
    if (dto.clientMutationId) {
      const existing = await this.prisma.familyMessageV2.findFirst({ where: { conversationId, clientMutationId: dto.clientMutationId } });
      if (existing) return existing;
    }
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyMessageV2.create({ data: { conversationId, senderUserId: user.sub, body: dto.body.trim(), priority: dto.priority, clientMutationId: dto.clientMutationId, status: Onda1MessageStatus.ENVIADA } });
      await this.outbox(tx, user, 'FamilyMessageCreated', 'FamilyMessageV2', created.id, { conversationId, messageId: created.id });
      return created;
    });
    await this.audit.log({ action: 'CREATE', entity: 'FAMILY_MESSAGE', entityId: message.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: conversation.unitId });
    return message;
  }

  async listContributions(childId: string, user: JwtPayload) {
    await this.assertFlag(user);
    await this.childInScope(childId, user);
    const isFamily = user.roles?.some((role) => role.level === RoleLevel.FAMILIA);
    return this.prisma.familyContribution.findMany({ where: { mantenedoraId: user.mantenedoraId, childId, ...(isFamily ? { status: Onda1ReviewTaskStatus.APPROVED, visibility: 'FAMILIA_AUTORIZADA' } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async createContribution(dto: CreateFamilyContributionDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyContribute);
    const child = await this.childInScope(dto.childId, user);
    if (dto.goalId) {
      const goal = await this.prisma.childGoal.findFirst({ where: { id: dto.goalId, childId: child.id, mantenedoraId: user.mantenedoraId } });
      if (!goal) throw new NotFoundException('Objetivo não encontrado para a contribuição.');
    }
    if (dto.evidenceId) {
      const evidence = await this.prisma.childEvidence.findFirst({ where: { id: dto.evidenceId, childId: child.id, mantenedoraId: user.mantenedoraId } });
      if (!evidence) throw new NotFoundException('Evidência não encontrada para a contribuição.');
    }
    const contribution = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyContribution.create({ data: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId: child.id, authorUserId: user.sub, contributionType: dto.contributionType, content: dto.content.trim(), structuredData: dto.structuredData as Prisma.InputJsonValue | undefined, goalId: dto.goalId, evidenceId: dto.evidenceId } });
      await this.outbox(tx, user, 'FamilyContributionCreated', 'FamilyContribution', created.id, { contributionId: created.id, childId: child.id });
      return created;
    });
    await this.audit.log({ action: 'CREATE', entity: 'FAMILY_CONTRIBUTION', entityId: contribution.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId });
    return contribution;
  }

  async createConsent(dto: CreateConsentGrantDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.consentManage);
    const child = await this.childInScope(dto.childId, user);
    const consent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.consentGrant.create({ data: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId: child.id, responsibleUserId: user.sub, purpose: dto.purpose, decision: dto.decision, policyVersion: dto.policyVersion.trim(), textPresented: dto.textPresented, origin: dto.origin.trim(), proof: dto.proof as Prisma.InputJsonValue | undefined, validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined } });
      await this.outbox(tx, user, 'ConsentGrantRecorded', 'ConsentGrant', created.id, { consentGrantId: created.id, childId: child.id, purpose: created.purpose, decision: created.decision });
      return created;
    });
    await this.audit.log({ action: 'CREATE', entity: 'CONSENT_GRANT', entityId: consent.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId, changes: { purpose: consent.purpose, decision: consent.decision } });
    return consent;
  }

  async listConsents(childId: string, user: JwtPayload) {
    await this.assertFlag(user);
    await this.childInScope(childId, user);
    const isFamily = user.roles?.some((role) => role.level === RoleLevel.FAMILIA);
    return this.prisma.consentGrant.findMany({ where: { mantenedoraId: user.mantenedoraId, childId, ...(isFamily ? { responsibleUserId: user.sub } : {}) }, orderBy: { decidedAt: 'desc' }, take: 100 });
  }

  async createPublication(dto: CreatePublicationDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyPublish);
    const child = await this.childInScope(dto.childId, user);
    const consent = dto.audienceType === 'FAMILIA' ? await this.activeConsent(child.id, dto.consentGrantId, user) : undefined;
    const publication = await this.prisma.publicationRecord.create({ data: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId: child.id, sourceType: dto.sourceType.trim(), sourceId: dto.sourceId, audienceType: dto.audienceType.trim(), audienceUserId: dto.audienceUserId, snapshot: dto.snapshot as Prisma.InputJsonValue, sensitivity: dto.sensitivity, consentGrantId: consent?.id, status: Onda1PublicationStatus.RASCUNHO, createdBy: user.sub } });
    await this.audit.log({ action: 'CREATE', entity: 'PUBLICATION_RECORD', entityId: publication.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId });
    return publication;
  }

  async publishPublication(publicationId: string, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyPublish);
    const publication = await this.prisma.publicationRecord.findFirst({ where: { id: publicationId, mantenedoraId: user.mantenedoraId } });
    if (!publication) throw new NotFoundException('Publicação não encontrada.');
    await this.childInScope(publication.childId, user);
    if (publication.audienceType === 'FAMILIA') await this.activeConsent(publication.childId, publication.consentGrantId ?? undefined, user);
    if (publication.status === Onda1PublicationStatus.PUBLICADA) return publication;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.publicationRecord.update({ where: { id: publicationId }, data: { status: Onda1PublicationStatus.PUBLICADA, reviewedBy: user.sub, publishedAt: new Date() } });
      await this.outbox(tx, user, 'PublicationPublished', 'PublicationRecord', result.id, { publicationId: result.id, childId: result.childId, audienceType: result.audienceType });
      return result;
    });
    await this.audit.log({ action: 'UPDATE', entity: 'PUBLICATION_RECORD', entityId: updated.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: updated.unitId, changes: { status: updated.status } });
    return updated;
  }

  async acknowledge(dto: CreateAcknowledgmentDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyMessage);
    const child = await this.childInScope(dto.childId, user);
    const acknowledgment = await this.prisma.acknowledgment.upsert({ where: { recordType_recordId_userId_kind: { recordType: dto.recordType, recordId: dto.recordId, userId: user.sub, kind: dto.kind } }, create: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId: child.id, recordType: dto.recordType, recordId: dto.recordId, userId: user.sub, kind: dto.kind, metadata: dto.metadata as Prisma.InputJsonValue | undefined }, update: { acknowledgedAt: new Date(), metadata: dto.metadata as Prisma.InputJsonValue | undefined } });
    await this.audit.log({ action: 'CREATE', entity: 'ACKNOWLEDGMENT', entityId: acknowledgment.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId });
    return acknowledgment;
  }

  async getCommunicationPreference(user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyMessage);
    return this.prisma.communicationPreference.findUnique({ where: { mantenedoraId_userId: { mantenedoraId: user.mantenedoraId, userId: user.sub } } });
  }

  async upsertCommunicationPreference(dto: UpsertCommunicationPreferenceDto, user: JwtPayload) {
    await this.assertFlag(user);
    this.access.assertCapability(user, ONDA1_CAPABILITIES.familyMessage);
    const preference = await this.prisma.communicationPreference.upsert({ where: { mantenedoraId_userId: { mantenedoraId: user.mantenedoraId, userId: user.sub } }, create: { mantenedoraId: user.mantenedoraId, userId: user.sub, locale: dto.locale ?? 'pt-BR', channels: dto.channels as Prisma.InputJsonValue | undefined, quietHoursStart: dto.quietHoursStart, quietHoursEnd: dto.quietHoursEnd, importantAlerts: dto.importantAlerts ?? true }, update: { locale: dto.locale, channels: dto.channels as Prisma.InputJsonValue | undefined, quietHoursStart: dto.quietHoursStart, quietHoursEnd: dto.quietHoursEnd, importantAlerts: dto.importantAlerts } });
    await this.audit.log({ action: 'UPDATE', entity: 'COMMUNICATION_PREFERENCE', entityId: preference.id, userId: user.sub, mantenedoraId: user.mantenedoraId });
    return preference;
  }
}
