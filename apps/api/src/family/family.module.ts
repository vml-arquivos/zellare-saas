import { Module } from "@nestjs/common";
import { FamilyController } from "./family.controller";
import { FamilyService } from "./family.service";
import { FamilyPrivacyGuard } from "./family-privacy.guard";
import { EvidenceModule } from "../evidence/evidence.module";

@Module({
  imports: [EvidenceModule],
  controllers: [FamilyController],
  providers: [FamilyService, FamilyPrivacyGuard],
  exports: [FamilyService],
})
export class FamilyModule {}
