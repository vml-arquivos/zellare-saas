import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { FeatureFlagsService, FeatureFlags } from '../feature-flags/feature-flags.service';
import { UpsertTenantBrandingDto, SetFeatureFlagDto } from './dto/tenant-config.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

// Catálogo de flags de módulo conhecidas — não são por cargo, são por plano/tenant.
// Mantido como referência para validação e para o painel de administração listar
// o que está disponível, mesmo antes de qualquer linha existir no banco.
export const KNOWN_TENANT_FLAG_KEYS = [
  'modulo_estoque',
  'modulo_compras',
  'modulo_transporte',
  'ia_assistiva',
  'portal_familia',
  'upload_conteudo_proprio',
  'multiplos_frameworks_pedagogicos',
  'modo_offline',
] as const;

@Injectable()
export class TenantConfigService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private legacyFeatureFlags: FeatureFlagsService,
  ) {}

  private isMantenedoraAdmin(user: JwtPayload): boolean {
    const level = user.roles[0]?.level;
    return level === 'DEVELOPER' || level === 'MANTENEDORA';
  }

  /**
   * Configuração completa que o frontend consome no boot: branding da
   * instituição + flags por cargo (legado) mescladas com flags reais por
   * tenant (novo). Ponto único de leitura para o app inteiro.
   */
  async getFullConfig(user: JwtPayload) {
    const [branding, tenantFlags] = await Promise.all([
      this.prisma.tenantBranding.findUnique({ where: { mantenedoraId: user.mantenedoraId } }),
      this.prisma.tenantFeatureFlag.findMany({ where: { mantenedoraId: user.mantenedoraId } }),
    ]);

    const roleFlags: FeatureFlags = this.legacyFeatureFlags.getFlagsForUser(user);

    const tenantFlagsMap = Object.fromEntries(
      tenantFlags.map((f) => [f.flagKey, { enabled: f.enabled, config: f.config }]),
    );

    return {
      branding: branding ?? null,
      roleFlags,
      tenantFlags: tenantFlagsMap,
    };
  }

  async getBranding(mantenedoraId: string) {
    return this.prisma.tenantBranding.findUnique({ where: { mantenedoraId } });
  }

  /**
   * Cria ou atualiza o branding da instituição — é 1:1 por mantenedora,
   * então upsert é o único fluxo necessário (não existe "criar mais de um").
   */
  async upsertBranding(dto: UpsertTenantBrandingDto, user: JwtPayload) {
    if (!this.isMantenedoraAdmin(user)) {
      throw new ForbiddenException('Apenas Mantenedora pode alterar a identidade visual da instituição');
    }

    if (dto.customDomain) {
      const domainInUse = await this.prisma.tenantBranding.findFirst({
        where: { customDomain: dto.customDomain, mantenedoraId: { not: user.mantenedoraId } },
      });
      if (domainInUse) {
        throw new ForbiddenException('Este domínio já está em uso por outra instituição');
      }
    }

    const branding = await this.prisma.tenantBranding.upsert({
      where: { mantenedoraId: user.mantenedoraId },
      create: { mantenedoraId: user.mantenedoraId, ...dto },
      update: dto,
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'TENANT_BRANDING' as any,
      entityId: branding.id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
      changes: dto as Record<string, any>,
    });

    return branding;
  }

  async listTenantFlags(user: JwtPayload) {
    return this.prisma.tenantFeatureFlag.findMany({ where: { mantenedoraId: user.mantenedoraId } });
  }

  /**
   * Liga/desliga um módulo inteiro para o tenant. Restrito a DEVELOPER —
   * é uma decisão de plano/contrato, não uma preferência da instituição.
   */
  async setFlag(dto: SetFeatureFlagDto, user: JwtPayload) {
    if (user.roles[0]?.level !== 'DEVELOPER') {
      throw new ForbiddenException('Apenas DEVELOPER pode alterar feature flags de módulo por tenant');
    }

    const flag = await this.prisma.tenantFeatureFlag.upsert({
      where: { mantenedoraId_flagKey: { mantenedoraId: user.mantenedoraId, flagKey: dto.flagKey } },
      create: {
        mantenedoraId: user.mantenedoraId,
        flagKey: dto.flagKey,
        enabled: dto.enabled,
        config: dto.config,
      },
      update: { enabled: dto.enabled, config: dto.config },
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'FEATURE_FLAG' as any,
      entityId: flag.id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
      changes: { flagKey: dto.flagKey, enabled: dto.enabled },
    });

    return flag;
  }
}
