import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { Onda2AccessService } from './onda2-access.service';
import { Onda2Controller } from './onda2.controller';
import { Onda2ComplianceService } from './onda2-compliance.service';
import { Onda2CoverageService } from './onda2-coverage.service';
import { Onda2FacilitiesService } from './onda2-facilities.service';
import { Onda2PulseService } from './onda2-pulse.service';

@Module({
  imports: [PrismaModule],
  controllers: [Onda2Controller],
  providers: [Onda2AccessService, Onda2PulseService, Onda2CoverageService, Onda2FacilitiesService, Onda2ComplianceService],
  exports: [Onda2AccessService, Onda2PulseService, Onda2CoverageService, Onda2FacilitiesService, Onda2ComplianceService],
})
export class Onda2Module {}
