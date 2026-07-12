import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class GerarIdeiasRapidasDto {
  /** O que o professor precisa agora, em linguagem livre — ex: "brincadeiras de roda pro pátio", "acalmar depois do almoço" */
  @IsString()
  necessidade: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(72)
  ageRangeMeses?: number;

  /** Quantas ideias trazer de uma vez — rápido e direto, não é um plano estruturado */
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  quantidade?: number;
}
