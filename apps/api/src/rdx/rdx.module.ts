import { Module } from '@nestjs/common';
import { RdxController } from './rdx.controller';
import { RdxService } from './rdx.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { StorageService } from '../common/services/storage.service';

@Module({
  imports: [PrismaModule, EvidenceModule],
  controllers: [RdxController],
  providers: [RdxService, StorageService],
  exports: [RdxService],
})
export class RdxModule {}
