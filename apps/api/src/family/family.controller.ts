import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RoleLevel } from "@prisma/client";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireRoles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { FamilyPrivacyGuard } from "./family-privacy.guard";
import {
  CreateFamilyMessageDto,
  CreateGuardianLinkDto,
  FamilyChildrenQueryDto,
  RevokeGuardianDto,
  FamilyGuardianCandidatesQueryDto,
  FamilyQueryDto,
  FamilyTimelineQueryDto,
} from "./dto/family.dto";
import { FamilyService } from "./family.service";

const FAMILY_AND_STAFF_ROLES = [
  RoleLevel.FAMILIA,
  RoleLevel.PROFESSOR,
  RoleLevel.UNIDADE,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.MANTENEDORA,
  RoleLevel.DEVELOPER,
];

@Controller("family")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FamilyController {
  constructor(private readonly service: FamilyService) {}

  @Get("children")
  @RequireRoles(...FAMILY_AND_STAFF_ROLES)
  listChildren(
    @Query() query: FamilyChildrenQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listChildren(user, query);
  }

  @Get("guardian-candidates")
  @RequireRoles(
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  @UseGuards(FamilyPrivacyGuard)
  listGuardianCandidates(
    @Query() query: FamilyGuardianCandidatesQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listGuardianCandidates(user, query);
  }

  @Get("children/:childId/guardians")
  @RequireRoles(
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  @UseGuards(FamilyPrivacyGuard)
  listGuardians(
    @Param("childId") childId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listGuardians(childId, user);
  }

  @Post("children/:childId/guardians")
  @RequireRoles(
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  @UseGuards(FamilyPrivacyGuard)
  linkGuardian(
    @Param("childId") childId: string,
    @Body() dto: CreateGuardianLinkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.linkGuardian(childId, dto, user);
  }

  @Delete("children/:childId/guardians/:guardianUserId")
  @RequireRoles(
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  @UseGuards(FamilyPrivacyGuard)
  revokeGuardian(
    @Param("childId") childId: string,
    @Param("guardianUserId") guardianUserId: string,
    @Body() dto: RevokeGuardianDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.revokeGuardian(childId, guardianUserId, dto, user);
  }

  @Get("children/:childId/timeline")
  @RequireRoles(...FAMILY_AND_STAFF_ROLES)
  timeline(
    @Param("childId") childId: string,
    @Query() query: FamilyTimelineQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.timeline(childId, query, user);
  }

  @Get("messages")
  @RequireRoles(...FAMILY_AND_STAFF_ROLES)
  listMessages(
    @Query() query: FamilyQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listMessages(user, query);
  }

  @Post("children/:childId/messages")
  @RequireRoles(...FAMILY_AND_STAFF_ROLES)
  sendMessage(
    @Param("childId") childId: string,
    @Body() dto: CreateFamilyMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.sendMessage(childId, dto, user);
  }

  @Patch("messages/:id/read")
  @RequireRoles(...FAMILY_AND_STAFF_ROLES)
  markMessageRead(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markMessageRead(id, user);
  }
}
