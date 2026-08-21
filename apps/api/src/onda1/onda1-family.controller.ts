import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda1FamilyService } from './onda1-family.service';
import {
  CreateAcknowledgmentDto,
  CreateConsentGrantDto,
  CreateFamilyContributionDto,
  CreateFamilyConversationDto,
  CreateFamilyMessageDto,
  CreatePublicationDto,
  FamilyFeedQueryDto,
  UpsertCommunicationPreferenceDto,
  UpdateFamilyConversationDto,
} from './dto/onda1.dto';

const FAMILY_ROLES = [RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER, RoleLevel.FAMILIA];
const STAFF_ROLES = [RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER];

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class Onda1FamilyController {
  constructor(private readonly service: Onda1FamilyService) {}

  @Get('children/:childId/family-circle')
  @RequireRoles(...FAMILY_ROLES)
  feed(@Param('childId') childId: string, @Query() query: FamilyFeedQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.feed(childId, query, user);
  }

  @Get('children/:childId/family-conversations')
  @RequireRoles(...FAMILY_ROLES)
  listConversations(@Param('childId') childId: string, @CurrentUser() user: JwtPayload) {
    return this.service.listConversations(childId, user);
  }

  @Post('family-conversations')
  @RequireRoles(...FAMILY_ROLES)
  createConversation(@Body() dto: CreateFamilyConversationDto, @CurrentUser() user: JwtPayload) {
    return this.service.createConversation(dto, user);
  }

  @Patch('family-conversations/:conversationId')
  @RequireRoles(...STAFF_ROLES)
  updateConversation(@Param('conversationId') conversationId: string, @Body() dto: UpdateFamilyConversationDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateConversation(conversationId, dto, user);
  }

  @Get('family-conversations/:conversationId/messages')
  @RequireRoles(...FAMILY_ROLES)
  listMessages(@Param('conversationId') conversationId: string, @Query() query: FamilyFeedQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listMessages(conversationId, query, user);
  }

  @Post('family-conversations/:conversationId/messages')
  @RequireRoles(...FAMILY_ROLES)
  createMessage(@Param('conversationId') conversationId: string, @Body() dto: CreateFamilyMessageDto, @CurrentUser() user: JwtPayload) {
    return this.service.createMessage(conversationId, dto, user);
  }

  @Get('children/:childId/family-contributions')
  @RequireRoles(...FAMILY_ROLES)
  listContributions(@Param('childId') childId: string, @CurrentUser() user: JwtPayload) {
    return this.service.listContributions(childId, user);
  }

  @Post('family-contributions')
  @RequireRoles(RoleLevel.FAMILIA)
  createContribution(@Body() dto: CreateFamilyContributionDto, @CurrentUser() user: JwtPayload) {
    return this.service.createContribution(dto, user);
  }

  @Get('children/:childId/consents')
  @RequireRoles(...FAMILY_ROLES)
  listConsents(@Param('childId') childId: string, @CurrentUser() user: JwtPayload) {
    return this.service.listConsents(childId, user);
  }

  @Post('children/:childId/consents')
  @RequireRoles(...FAMILY_ROLES)
  createConsent(@Param('childId') childId: string, @Body() dto: CreateConsentGrantDto, @CurrentUser() user: JwtPayload) {
    return this.service.createConsent({ ...dto, childId }, user);
  }

  @Post('children/:childId/publications')
  @RequireRoles(...STAFF_ROLES)
  createPublication(@Param('childId') childId: string, @Body() dto: CreatePublicationDto, @CurrentUser() user: JwtPayload) {
    return this.service.createPublication({ ...dto, childId }, user);
  }

  @Post('family/publications/:publicationId/publish')
  @RequireRoles(...STAFF_ROLES)
  publishPublication(@Param('publicationId') publicationId: string, @CurrentUser() user: JwtPayload) {
    return this.service.publishPublication(publicationId, user);
  }

  @Post('children/:childId/acknowledgments')
  @RequireRoles(...FAMILY_ROLES)
  acknowledge(@Param('childId') childId: string, @Body() dto: CreateAcknowledgmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.acknowledge({ ...dto, childId }, user);
  }

  @Get('me/communication-preferences')
  @RequireRoles(...FAMILY_ROLES)
  getCommunicationPreference(@CurrentUser() user: JwtPayload) {
    return this.service.getCommunicationPreference(user);
  }

  @Put('me/communication-preferences')
  @RequireRoles(...FAMILY_ROLES)
  upsertCommunicationPreference(@Body() dto: UpsertCommunicationPreferenceDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsertCommunicationPreference(dto, user);
  }
}
