import { Module } from '@nestjs/common';
import { AtendimentoPaisController } from './atendimento-pais.controller';
import { AtendimentoPaisService } from './atendimento-pais.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [PrismaModule, EvidenceModule],
  controllers: [AtendimentoPaisController],
  providers: [AtendimentoPaisService],
  exports: [AtendimentoPaisService],
})
export class AtendimentoPaisModule {}
