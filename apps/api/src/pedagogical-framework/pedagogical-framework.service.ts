import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { CreatePedagogicalFrameworkDto } from './dto/create-pedagogical-framework.dto';
import { UpdatePedagogicalFrameworkDto } from './dto/update-pedagogical-framework.dto';
import { QueryPedagogicalFrameworkDto } from './dto/query-pedagogical-framework.dto';
import { CreateFrameworkDimensionDto } from './dto/create-pedagogical-framework.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class PedagogicalFrameworkService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private canManageFrameworks(user: JwtPayload): boolean {
    const level = user.roles[0]?.level;
    return level === 'DEVELOPER' || level === 'MANTENEDORA' || level === 'STAFF_CENTRAL';
  }

  /**
   * Cria um framework pedagógico novo, pertencente à mantenedora do usuário.
   * Aceita dimensões e objetivos aninhados numa única chamada (útil para
   * uma instituição montar o próprio currículo do zero, ou para o seed
   * inicial de um framework oficial como a BNCC).
   *
   * Frameworks globais da biblioteca (mantenedoraId nulo) só podem ser
   * criados por DEVELOPER — são curados pela própria Zelare, não por tenants.
   */
  async create(createDto: CreatePedagogicalFrameworkDto, user: JwtPayload, isGlobal = false) {
    if (isGlobal && user.roles[0]?.level !== 'DEVELOPER') {
      throw new ForbiddenException(
        'Apenas DEVELOPER pode criar frameworks na biblioteca global da plataforma',
      );
    }
    if (!isGlobal && !this.canManageFrameworks(user)) {
      throw new ForbiddenException(
        'Apenas Mantenedora e Staff Central podem criar frameworks pedagógicos',
      );
    }

    const framework = await this.prisma.pedagogicalFramework.create({
      data: {
        name: createDto.name,
        country: createDto.country,
        region: createDto.region,
        isOfficial: createDto.isOfficial ?? false,
        version: createDto.version ?? 1,
        description: createDto.description,
        sourceUrl: createDto.sourceUrl,
        mantenedoraId: isGlobal ? null : user.mantenedoraId,
        createdBy: user.sub,
      },
    });

    // Dimensões e objetivos são criados em etapas (não em nested-create profundo)
    // — mais simples de tipar corretamente e mais fácil de depurar se algo falhar
    // no meio do caminho (um objetivo com dado inválido não derruba a dimensão inteira).
    if (createDto.dimensions?.length) {
      for (let dimIndex = 0; dimIndex < createDto.dimensions.length; dimIndex++) {
        const dim = createDto.dimensions[dimIndex];
        const createdDim = await this.prisma.frameworkDimension.create({
          data: {
            frameworkId: framework.id,
            code: dim.code,
            name: dim.name,
            description: dim.description,
            order: dim.order ?? dimIndex,
          },
        });

        if (dim.objectives?.length) {
          for (const obj of dim.objectives) {
            await this.prisma.frameworkObjective.create({
              data: {
                frameworkId: framework.id,
                dimensionId: createdDim.id,
                code: obj.code,
                ageRangeMin: obj.ageRangeMin,
                ageRangeMax: obj.ageRangeMax,
                text: obj.text,
              },
            });
          }
        }
      }
    }

    const frameworkCompleto = await this.prisma.pedagogicalFramework.findUnique({
      where: { id: framework.id },
      include: { dimensions: { include: { objectives: true } } },
    });

    await this.auditService.log({
      action: 'CREATE',
      entity: 'PEDAGOGICAL_FRAMEWORK' as any,
      entityId: framework.id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
      changes: { name: framework.name, isGlobal, dimensionsCount: createDto.dimensions?.length ?? 0 },
    });

    return frameworkCompleto;
  }

  /**
   * Lista frameworks disponíveis para o usuário: os próprios da mantenedora
   * dele + (por padrão) os globais curados pela plataforma.
   */
  async findAll(query: QueryPedagogicalFrameworkDto, user: JwtPayload) {
    const includeGlobal = query.includeGlobalLibrary ?? true;

    return this.prisma.pedagogicalFramework.findMany({
      where: {
        OR: includeGlobal
          ? [{ mantenedoraId: user.mantenedoraId }, { mantenedoraId: null }]
          : [{ mantenedoraId: user.mantenedoraId }],
        ...(query.country && { country: query.country }),
        ...(query.isOfficial !== undefined && { isOfficial: query.isOfficial }),
        ...(query.isActive !== undefined && { isActive: query.isActive }),
      },
      include: {
        dimensions: { orderBy: { order: 'asc' } },
        _count: { select: { objectives: true } },
      },
      orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const framework = await this.prisma.pedagogicalFramework.findUnique({
      where: { id },
      include: {
        dimensions: {
          orderBy: { order: 'asc' },
          include: { objectives: { orderBy: { ageRangeMin: 'asc' } } },
        },
      },
    });

    if (!framework) {
      throw new NotFoundException('Framework pedagógico não encontrado');
    }

    // Isolamento: só pode ver frameworks da própria mantenedora ou globais
    if (framework.mantenedoraId && framework.mantenedoraId !== user.mantenedoraId) {
      throw new ForbiddenException('Sem acesso a este framework pedagógico');
    }

    return framework;
  }

  async update(id: string, updateDto: UpdatePedagogicalFrameworkDto, user: JwtPayload) {
    const framework = await this.findOne(id, user);

    if (!framework.mantenedoraId) {
      throw new ForbiddenException(
        'Frameworks da biblioteca global não podem ser editados por um tenant — clone-o primeiro',
      );
    }
    if (!this.canManageFrameworks(user)) {
      throw new ForbiddenException('Sem permissão para editar frameworks pedagógicos');
    }

    const updated = await this.prisma.pedagogicalFramework.update({
      where: { id },
      data: updateDto,
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'PEDAGOGICAL_FRAMEWORK' as any,
      entityId: id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
      changes: updateDto as Record<string, any>,
    });

    return updated;
  }

  /**
   * Clona um framework (tipicamente um global da biblioteca) para dentro da
   * mantenedora do usuário, já podendo editar a partir daí sem afetar o original.
   * É o caminho recomendado para "pegar a BNCC e adaptar" em vez de criar do zero.
   */
  async clone(id: string, user: JwtPayload) {
    const source = await this.prisma.pedagogicalFramework.findUnique({
      where: { id },
      include: { dimensions: { include: { objectives: true } } },
    });

    if (!source) {
      throw new NotFoundException('Framework de origem não encontrado');
    }
    if (!this.canManageFrameworks(user)) {
      throw new ForbiddenException('Sem permissão para clonar frameworks pedagógicos');
    }

    const clone = await this.prisma.pedagogicalFramework.create({
      data: {
        name: `${source.name} (cópia)`,
        country: source.country,
        region: source.region,
        isOfficial: false,
        version: 1,
        description: source.description,
        sourceUrl: source.sourceUrl,
        mantenedoraId: user.mantenedoraId,
        createdBy: user.sub,
      },
    });

    for (const dim of source.dimensions) {
      const clonedDim = await this.prisma.frameworkDimension.create({
        data: {
          frameworkId: clone.id,
          code: dim.code,
          name: dim.name,
          description: dim.description,
          order: dim.order,
        },
      });

      for (const obj of dim.objectives) {
        await this.prisma.frameworkObjective.create({
          data: {
            frameworkId: clone.id,
            dimensionId: clonedDim.id,
            code: obj.code,
            ageRangeMin: obj.ageRangeMin,
            ageRangeMax: obj.ageRangeMax,
            text: obj.text,
          },
        });
      }
    }

    const cloneCompleto = await this.prisma.pedagogicalFramework.findUnique({
      where: { id: clone.id },
      include: { dimensions: { include: { objectives: true } } },
    });

    await this.auditService.log({
      action: 'CREATE',
      entity: 'PEDAGOGICAL_FRAMEWORK' as any,
      entityId: clone.id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
      changes: { clonedFrom: source.id, clonedFromName: source.name },
    });

    return cloneCompleto;
  }

  async remove(id: string, user: JwtPayload) {
    const framework = await this.findOne(id, user);

    if (!framework.mantenedoraId) {
      throw new ForbiddenException('Frameworks da biblioteca global não podem ser removidos por um tenant');
    }
    if (user.roles[0]?.level !== 'DEVELOPER' && user.roles[0]?.level !== 'MANTENEDORA') {
      throw new ForbiddenException('Apenas Mantenedora pode remover um framework pedagógico');
    }

    // Bloqueia remoção se já houver entradas de matriz curricular usando objetivos deste framework
    const inUse = await this.prisma.curriculumMatrixEntry.findFirst({
      where: { frameworkObjective: { frameworkId: id } },
    });
    if (inUse) {
      throw new BadRequestException(
        'Este framework já está em uso por entradas de matriz curricular e não pode ser removido. Desative-o em vez de remover.',
      );
    }

    await this.prisma.pedagogicalFramework.delete({ where: { id } });

    await this.auditService.log({
      action: 'DELETE',
      entity: 'PEDAGOGICAL_FRAMEWORK' as any,
      entityId: id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
    });

    return { success: true };
  }

  /**
   * Adiciona uma dimensão a um framework já existente (fluxo de edição
   * incremental, complementar ao create() que aceita tudo de uma vez).
   */
  async addDimension(frameworkId: string, dto: CreateFrameworkDimensionDto, user: JwtPayload) {
    const framework = await this.findOne(frameworkId, user);
    if (!framework.mantenedoraId) {
      throw new ForbiddenException('Não é possível editar um framework da biblioteca global — clone-o primeiro');
    }
    if (!this.canManageFrameworks(user)) {
      throw new ForbiddenException('Sem permissão para editar este framework');
    }

    const createdDim = await this.prisma.frameworkDimension.create({
      data: {
        frameworkId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        order: dto.order ?? 0,
      },
    });

    if (dto.objectives?.length) {
      for (const obj of dto.objectives) {
        await this.prisma.frameworkObjective.create({
          data: {
            frameworkId,
            dimensionId: createdDim.id,
            code: obj.code,
            ageRangeMin: obj.ageRangeMin,
            ageRangeMax: obj.ageRangeMax,
            text: obj.text,
          },
        });
      }
    }

    return this.prisma.frameworkDimension.findUnique({
      where: { id: createdDim.id },
      include: { objectives: true },
    });
  }
}
