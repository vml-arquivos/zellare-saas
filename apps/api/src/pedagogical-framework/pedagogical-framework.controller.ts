import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PedagogicalFrameworkService } from './pedagogical-framework.service';
import {
  CreatePedagogicalFrameworkDto,
  CreateFrameworkDimensionDto,
} from './dto/create-pedagogical-framework.dto';
import { UpdatePedagogicalFrameworkDto } from './dto/update-pedagogical-framework.dto';
import { QueryPedagogicalFrameworkDto } from './dto/query-pedagogical-framework.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('pedagogical-frameworks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedagogicalFrameworkController {
  constructor(private readonly frameworkService: PedagogicalFrameworkService) {}

  @Post()
  @RequireRoles('DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL')
  create(@Body() createDto: CreatePedagogicalFrameworkDto, @CurrentUser() user: JwtPayload) {
    return this.frameworkService.create(createDto, user, false);
  }

  /**
   * Cria um framework na biblioteca global da plataforma (curada pela Zelare,
   * disponível para qualquer tenant escolher/clonar). Restrito a DEVELOPER.
   */
  @Post('global')
  @RequireRoles('DEVELOPER')
  createGlobal(@Body() createDto: CreatePedagogicalFrameworkDto, @CurrentUser() user: JwtPayload) {
    return this.frameworkService.create(createDto, user, true);
  }

  @Get()
  findAll(@Query() query: QueryPedagogicalFrameworkDto, @CurrentUser() user: JwtPayload) {
    return this.frameworkService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frameworkService.findOne(id, user);
  }

  @Patch(':id')
  @RequireRoles('DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePedagogicalFrameworkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.frameworkService.update(id, updateDto, user);
  }

  /**
   * Clona um framework (tipicamente da biblioteca global) para a mantenedora
   * do usuário — o caminho recomendado para "pegar a BNCC e adaptar".
   */
  @Post(':id/clone')
  @RequireRoles('DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL')
  clone(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frameworkService.clone(id, user);
  }

  @Post(':id/dimensions')
  @RequireRoles('DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL')
  addDimension(
    @Param('id') id: string,
    @Body() dto: CreateFrameworkDimensionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.frameworkService.addDimension(id, dto, user);
  }

  @Delete(':id')
  @RequireRoles('DEVELOPER', 'MANTENEDORA')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frameworkService.remove(id, user);
  }
}
