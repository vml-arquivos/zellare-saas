import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AtendimentoPaisService } from './atendimento-pais.service';
import { CreateAtendimentoDto, ListAtendimentoQueryDto, UpdateAtendimentoStatusDto } from './dto/create-atendimento.dto';
import { RoleLevel } from '@prisma/client';

@Controller('atendimentos-pais')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AtendimentoPaisController {
  constructor(private readonly svc: AtendimentoPaisService) {}

  @Post()
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  criar(@Body() dto: CreateAtendimentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criar(dto, user);
  }

  @Get()
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listar(@CurrentUser() user: JwtPayload, @Query() query: ListAtendimentoQueryDto) {
    return this.svc.listar(user, query);
  }

  @Patch(':id/status')
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  atualizarStatus(@Param('id') id: string, @Body() body: UpdateAtendimentoStatusDto, @CurrentUser() user: JwtPayload) {
    return this.svc.atualizarStatus(id, body.status, user);
  }
}
