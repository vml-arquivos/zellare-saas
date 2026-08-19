import { Module } from '@nestjs/common';
import { CoordenacaoController } from './coordenacao.controller';
import { CoordenacaoService } from './coordenacao.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [PrismaModule, EvidenceModule],
  controllers: [CoordenacaoController],
  providers: [CoordenacaoService],
  exports: [CoordenacaoService],
})
export class CoordenacaoModule {}
