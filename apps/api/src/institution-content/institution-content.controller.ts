import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InstitutionContentService } from './institution-content.service';
import { CreateContentUploadDto, ReviewContentUploadDto } from './dto/institution-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('institution-content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitutionContentController {
  constructor(private readonly contentService: InstitutionContentService) {}

  /**
   * Upload de plano de aula / projeto / material próprio da instituição.
   * Aceito por professor até coordenação — cada um sobe o que já usa no
   * dia a dia; a revisão/aprovação é que decide o que vira template oficial.
   */
  @Post('upload')
  @RequireRoles('DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL', 'UNIDADE', 'PROFESSOR')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateContentUploadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contentService.upload(file, dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.contentService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.contentService.findOne(id, user);
  }

  @Post(':id/approve')
  @RequireRoles('DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL', 'UNIDADE')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewContentUploadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contentService.review(id, dto, true, user);
  }

  @Post(':id/reject')
  @RequireRoles('DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL', 'UNIDADE')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewContentUploadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contentService.review(id, dto, false, user);
  }
}
