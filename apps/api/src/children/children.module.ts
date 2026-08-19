import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [
    PrismaModule,
    EvidenceModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ChildrenController],
  providers: [ChildrenService],
  exports: [ChildrenService],
})
export class ChildrenModule {}
