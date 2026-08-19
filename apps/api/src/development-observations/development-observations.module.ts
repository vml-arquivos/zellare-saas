import { Module } from '@nestjs/common';
import { DevelopmentObservationsService } from './development-observations.service';
import { DevelopmentObservationsController } from './development-observations.controller';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [EvidenceModule],
  controllers: [DevelopmentObservationsController],
  providers: [DevelopmentObservationsService],
  exports: [DevelopmentObservationsService],
})
export class DevelopmentObservationsModule {}
