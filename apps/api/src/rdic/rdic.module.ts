import { Module } from '@nestjs/common';
import { RdicController } from './rdic.controller';
import { RdicService } from './rdic.service';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [EvidenceModule],
  controllers: [RdicController],
  providers: [RdicService],
  exports: [RdicService],
})
export class RdicModule {}
