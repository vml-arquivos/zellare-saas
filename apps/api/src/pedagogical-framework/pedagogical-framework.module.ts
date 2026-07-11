import { Module } from '@nestjs/common';
import { PedagogicalFrameworkService } from './pedagogical-framework.service';
import { PedagogicalFrameworkController } from './pedagogical-framework.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from '../common/services/audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [PedagogicalFrameworkController],
  providers: [PedagogicalFrameworkService, AuditService],
  exports: [PedagogicalFrameworkService],
})
export class PedagogicalFrameworkModule {}
