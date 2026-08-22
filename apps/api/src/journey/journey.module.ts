import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { JourneyController } from "./journey.controller";
import { JourneyService } from "./journey.service";
import { JourneyAccessService } from "./journey-access.service";
import { AuditService } from "../common/services/audit.service";

@Module({
  imports: [PrismaModule],
  controllers: [JourneyController],
  providers: [JourneyService, JourneyAccessService, AuditService],
  exports: [JourneyService],
})
export class JourneyModule {}
