import { Module } from '@nestjs/common';
import { TeacherRankingController } from './teacher-ranking.controller';
import { TeacherRankingService } from './teacher-ranking.service';

@Module({
  controllers: [TeacherRankingController],
  providers: [TeacherRankingService],
  exports: [TeacherRankingService],
})
export class TeacherRankingModule {}
