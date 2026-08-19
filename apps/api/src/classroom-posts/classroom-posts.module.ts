import { Module } from '@nestjs/common';
import { ClassroomPostsService } from './classroom-posts.service';
import { ClassroomPostsController } from './classroom-posts.controller';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [EvidenceModule],
  controllers: [ClassroomPostsController],
  providers: [ClassroomPostsService],
  exports: [ClassroomPostsService],
})
export class ClassroomPostsModule {}
