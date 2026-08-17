import { Module } from '@nestjs/common';
import { MetricsListener } from './metrics.listener';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  controllers: [MetricsController],
  providers: [MetricsListener, MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
