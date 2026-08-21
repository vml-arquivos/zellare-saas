import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Onda2AssetStatus,
  Onda2MaintenanceRequestStatus,
  Onda2Priority,
  Onda2SpaceStatus,
  Onda2WorkOrderStatus,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ONDA2_CAPABILITIES, ONDA2_FEATURE_FLAGS } from './onda2.constants';
import { Onda2AccessService } from './onda2-access.service';
import {
  AssignWorkOrderDto,
  ChangeWorkOrderStatusDto,
  CreateFacilityAssetDto,
  CreateFacilitySpaceDto,
  CreateMaintenanceRequestDto,
  CreateWorkOrderDto,
  Onda2ListQueryDto,
  TriageMaintenanceRequestDto,
} from './onda2.dto';

@Injectable()
export class Onda2FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: Onda2AccessService,
  ) {}

  async createSpace(dto: CreateFacilitySpaceDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.assetManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    return this.prisma.facilitySpace.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        parentId: dto.parentId,
        code: dto.code,
        name: dto.name,
        spaceType: dto.spaceType,
        capacity: dto.capacity,
        status: dto.status ?? Onda2SpaceStatus.AVAILABLE,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdBy: user.sub,
      },
    });
  }

  async listSpaces(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.assetRead);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.facilitySpace.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId, isActive: true }, orderBy: { name: 'asc' }, take: query.limit ?? 100 });
  }

  async createAsset(dto: CreateFacilityAssetDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.assetManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    return this.prisma.facilityAsset.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        spaceId: dto.spaceId,
        code: dto.code,
        qrToken: dto.qrToken,
        name: dto.name,
        category: dto.category,
        manufacturer: dto.manufacturer,
        model: dto.model,
        serialNumber: dto.serialNumber,
        status: dto.status ?? Onda2AssetStatus.OPERATIONAL,
        criticality: dto.criticality ?? Onda2Priority.NORMAL,
        warrantyEndsAt: dto.warrantyEndsAt ? new Date(dto.warrantyEndsAt) : undefined,
        supplierId: dto.supplierId,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdBy: user.sub,
      },
    });
  }

  async listAssets(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.assetRead);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.facilityAsset.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId },
      orderBy: { name: 'asc' },
      take: query.limit ?? 100,
      select: { id: true, unitId: true, spaceId: true, code: true, qrToken: true, name: true, category: true, manufacturer: true, model: true, serialNumber: true, status: true, criticality: true, warrantyEndsAt: true, metadata: true, version: true, createdAt: true, updatedAt: true },
    });
  }

  async createMaintenanceRequest(dto: CreateMaintenanceRequestDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.facilityRequestCreate);
    await this.access.assertUnitAccess(user, dto.unitId);
    const existing = await this.prisma.maintenanceRequest.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) return existing;
    const code = dto.code ?? `REQ-${Date.now()}`;
    return this.prisma.maintenanceRequest.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        spaceId: dto.spaceId,
        assetId: dto.assetId,
        code,
        category: dto.category,
        description: dto.description,
        impact: dto.impact,
        priority: dto.priority ?? Onda2Priority.NORMAL,
        safetyRisk: dto.safetyRisk ?? false,
        status: Onda2MaintenanceRequestStatus.SUBMITTED,
        requesterId: user.sub,
        idempotencyKey: dto.idempotencyKey,
      },
    });
  }

  async listMaintenanceRequests(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.facilityRequestTriage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.maintenanceRequest.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: [{ priority: 'desc' }, { submittedAt: 'desc' }], take: query.limit ?? 100 });
  }

  async triageMaintenanceRequest(id: string, dto: TriageMaintenanceRequestDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.facilityRequestTriage);
    const request = await this.prisma.maintenanceRequest.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!request) throw new NotFoundException('Solicitação de manutenção não encontrada');
    await this.access.assertUnitAccess(user, request.unitId);
    return this.prisma.maintenanceRequest.update({ where: { id }, data: { status: dto.status, triagedAt: new Date(), triagedBy: user.sub, triageReason: dto.triageReason } });
  }

  async createWorkOrder(dto: CreateWorkOrderDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.facilityRequestTriage);
    await this.access.assertUnitAccess(user, dto.unitId);
    if (dto.requestId) {
      const request = await this.prisma.maintenanceRequest.findFirst({ where: { id: dto.requestId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId } });
      if (!request) throw new NotFoundException('Solicitação de manutenção não encontrada no escopo informado');
    }
    return this.prisma.workOrder.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        requestId: dto.requestId,
        spaceId: dto.spaceId,
        assetId: dto.assetId,
        code: dto.code ?? `OS-${Date.now()}`,
        category: dto.category,
        description: dto.description,
        priority: dto.priority ?? Onda2Priority.NORMAL,
        status: Onda2WorkOrderStatus.OPEN,
        supplierId: dto.supplierId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        createdBy: user.sub,
      },
    });
  }

  async listWorkOrders(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.workorderRead);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.workOrder.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: query.limit ?? 100 });
  }

  async assignWorkOrder(id: string, dto: AssignWorkOrderDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.workorderAssign);
    const order = await this.prisma.workOrder.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');
    await this.access.assertUnitAccess(user, order.unitId);
    if (!dto.employeeId && !dto.supplierId) throw new BadRequestException('Informe employeeId ou supplierId');
    await this.prisma.workOrderAssignment.updateMany({ where: { workOrderId: id, unitId: order.unitId, active: true }, data: { active: false, unassignedAt: new Date() } });
    const assignment = await this.prisma.workOrderAssignment.create({ data: { mantenedoraId: user.mantenedoraId, unitId: order.unitId, workOrderId: id, employeeId: dto.employeeId, supplierId: dto.supplierId, assignedBy: user.sub } });
    return this.prisma.workOrder.update({ where: { id }, data: { assignedEmployeeId: dto.employeeId, supplierId: dto.supplierId, status: order.status === Onda2WorkOrderStatus.OPEN ? Onda2WorkOrderStatus.IN_PROGRESS : undefined } }).then(() => assignment);
  }

  async changeWorkOrderStatus(id: string, dto: ChangeWorkOrderStatusDto, user: JwtPayload) {
    const order = await this.prisma.workOrder.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');
    await this.access.assertUnitAccess(user, order.unitId);
    const existingEvent = await this.prisma.workOrderStatusEvent.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existingEvent) return order;
    this.assertTransition(order.status, dto.status);
    const capability = dto.status === Onda2WorkOrderStatus.VALIDATED || dto.status === Onda2WorkOrderStatus.CLOSED
      ? ONDA2_CAPABILITIES.workorderValidate
      : dto.status === Onda2WorkOrderStatus.REOPENED
        ? ONDA2_CAPABILITIES.workorderReopen
        : ONDA2_CAPABILITIES.workorderExecute;
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, capability);
    const now = new Date();
    const data: Prisma.WorkOrderUpdateInput = { status: dto.status };
    if (dto.status === Onda2WorkOrderStatus.IN_PROGRESS) data.startedAt = now;
    if (dto.status === Onda2WorkOrderStatus.COMPLETED) data.completedAt = now;
    if (dto.status === Onda2WorkOrderStatus.VALIDATED) data.validatedAt = now;
    if (dto.status === Onda2WorkOrderStatus.CLOSED) data.closedAt = now;
    if (dto.status === Onda2WorkOrderStatus.REOPENED) data.reopenedAt = now;

    const [updated] = await this.prisma.$transaction([
      this.prisma.workOrder.update({ where: { id }, data }),
      this.prisma.workOrderStatusEvent.create({ data: { mantenedoraId: user.mantenedoraId, unitId: order.unitId, workOrderId: id, fromStatus: order.status, toStatus: dto.status, reason: dto.reason, actorId: user.sub, idempotencyKey: dto.idempotencyKey } }),
    ]);
    return updated;
  }

  async facilitiesSummary(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1, ONDA2_CAPABILITIES.workorderRead);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    const where = { mantenedoraId: user.mantenedoraId, unitId: query.unitId };
    const [spaces, assets, requests, workOrders, overdue] = await Promise.all([
      this.prisma.facilitySpace.count({ where: { ...where, isActive: true } }),
      this.prisma.facilityAsset.count({ where }),
      this.prisma.maintenanceRequest.count({ where: { ...where, status: { in: [Onda2MaintenanceRequestStatus.SUBMITTED, Onda2MaintenanceRequestStatus.TRIAGE, Onda2MaintenanceRequestStatus.APPROVED] } } }),
      this.prisma.workOrder.count({ where: { ...where, status: { in: [Onda2WorkOrderStatus.OPEN, Onda2WorkOrderStatus.IN_PROGRESS, Onda2WorkOrderStatus.WAITING_PARTS, Onda2WorkOrderStatus.REOPENED] } } }),
      this.prisma.workOrder.count({ where: { ...where, dueAt: { lt: new Date() }, status: { in: [Onda2WorkOrderStatus.OPEN, Onda2WorkOrderStatus.IN_PROGRESS, Onda2WorkOrderStatus.WAITING_PARTS, Onda2WorkOrderStatus.REOPENED] } } }),
    ]);
    return { generatedAt: new Date().toISOString(), unitId: query.unitId ?? null, spaces, assets, openRequests: requests, openWorkOrders: workOrders, overdueWorkOrders: overdue, governance: { diagnosticInference: false, humanReviewRequired: true } };
  }

  private assertTransition(from: Onda2WorkOrderStatus, to: Onda2WorkOrderStatus): void {
    const allowed: Record<Onda2WorkOrderStatus, Onda2WorkOrderStatus[]> = {
      [Onda2WorkOrderStatus.OPEN]: [Onda2WorkOrderStatus.IN_PROGRESS, Onda2WorkOrderStatus.CANCELLED],
      [Onda2WorkOrderStatus.IN_PROGRESS]: [Onda2WorkOrderStatus.WAITING_PARTS, Onda2WorkOrderStatus.COMPLETED, Onda2WorkOrderStatus.CANCELLED],
      [Onda2WorkOrderStatus.WAITING_PARTS]: [Onda2WorkOrderStatus.IN_PROGRESS, Onda2WorkOrderStatus.CANCELLED],
      [Onda2WorkOrderStatus.COMPLETED]: [Onda2WorkOrderStatus.VALIDATED, Onda2WorkOrderStatus.REOPENED],
      [Onda2WorkOrderStatus.VALIDATED]: [Onda2WorkOrderStatus.CLOSED, Onda2WorkOrderStatus.REOPENED],
      [Onda2WorkOrderStatus.CLOSED]: [Onda2WorkOrderStatus.REOPENED],
      [Onda2WorkOrderStatus.REOPENED]: [Onda2WorkOrderStatus.IN_PROGRESS, Onda2WorkOrderStatus.CANCELLED],
      [Onda2WorkOrderStatus.CANCELLED]: [Onda2WorkOrderStatus.REOPENED],
    };
    if (!allowed[from].includes(to)) throw new BadRequestException(`Transição inválida: ${from} → ${to}`);
  }
}
