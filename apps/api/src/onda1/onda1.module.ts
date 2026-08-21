import { Module } from '@nestjs/common';
import { AuditService } from '../common/services/audit.service';
import { EvidenceModule } from '../evidence/evidence.module';
import { PrismaModule } from '../prisma/prisma.module';
import { Onda1AccessService } from './onda1-access.service';
import { Onda1EvidenceController } from './onda1-evidence.controller';
import { Onda1EvidenceService } from './onda1-evidence.service';
import { Onda1FamilyController } from './onda1-family.controller';
import { Onda1FamilyService } from './onda1-family.service';

@Module({
  imports: [PrismaModule, EvidenceModule],
  controllers: [Onda1EvidenceController, Onda1FamilyController],
  providers: [Onda1AccessService, Onda1EvidenceService, Onda1FamilyService, AuditService],
  exports: [Onda1AccessService, Onda1EvidenceService, Onda1FamilyService],
})
export class Onda1Module {}
