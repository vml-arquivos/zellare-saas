import { Module } from '@nestjs/common';
import { CareController } from './care.controller';
import { CareService } from './care.service';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [EvidenceModule],
  controllers: [CareController],
  providers: [CareService],
  exports: [CareService],
})
export class CareModule {}
