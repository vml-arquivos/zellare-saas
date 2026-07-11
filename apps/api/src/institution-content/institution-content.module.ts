import { Module } from '@nestjs/common';
import { InstitutionContentService } from './institution-content.service';
import { InstitutionContentController } from './institution-content.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from '../common/services/audit.service';
import { StorageService } from '../common/services/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [InstitutionContentController],
  providers: [InstitutionContentService, AuditService, StorageService],
  exports: [InstitutionContentService, StorageService],
})
export class InstitutionContentModule {}
