import { Module } from '@nestjs/common';
import { RdxController } from './rdx.controller';
import { RdxService } from './rdx.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [PrismaModule, EvidenceModule],
  controllers: [RdxController],
  providers: [RdxService],
  exports: [RdxService],
})
export class RdxModule {}
