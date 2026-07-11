import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePedagogicalFrameworkDto } from './create-pedagogical-framework.dto';

// Update não permite reenviar dimensions/objectives em bloco — isso tem endpoints próprios
// (evita apagar/recriar objetivos acidentalmente numa matriz já em uso por planejamentos ativos)
export class UpdatePedagogicalFrameworkDto extends PartialType(
  OmitType(CreatePedagogicalFrameworkDto, ['dimensions'] as const),
) {}
