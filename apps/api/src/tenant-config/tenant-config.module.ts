import { Module } from '@nestjs/common';
import { TenantConfigService } from './tenant-config.service';
import { TenantConfigController } from './tenant-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from '../common/services/audit.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [TenantConfigController],
  providers: [TenantConfigService, AuditService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
