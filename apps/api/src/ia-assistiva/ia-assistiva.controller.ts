import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IaAssistivaService } from './ia-assistiva.service';
import { GerarAtividadeDto } from './dto/gerar-atividade.dto';
import { GerarPlanoDeAulaDto } from './dto/gerar-plano-de-aula.dto';
import { GerarIdeiasRapidasDto } from './dto/gerar-ideias-rapidas.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('ia')
@UseGuards(JwtAuthGuard)
export class IaAssistivaController {
  constructor(private readonly iaService: IaAssistivaService) {}

  /**
   * POST /ia/gerar-atividade
   * Gera uma atividade pedagógica completa alinhada à Sequência Piloto 2026.
   *
   * Acesso: Professor, Unidade, Mantenedora, Developer
   *
   * REGRA: O Campo de Experiência e os Objetivos (BNCC + Currículo) são FIXOS
   * e devem vir da Sequência Piloto. A IA apenas cria a atividade.
   */
  @Post('gerar-atividade')
  @HttpCode(HttpStatus.OK)
  gerarAtividade(
    @Body() dto: GerarAtividadeDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.iaService.gerarAtividade(dto);
  }

  /**
   * POST /ia/microgestos
   * Gera sugestões de microgestos pedagógicos para um aluno específico.
   *
   * Acesso: Professor, Unidade, Mantenedora, Developer
   */
  @Post('microgestos')
  @HttpCode(HttpStatus.OK)
  gerarMicrogestos(
    @Body()
    body: {
      nomeAluno: string;
      faixaEtaria: string;
      observacoes: string;
      campoDeExperiencia: string;
    },
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.iaService.gerarMicrogestos(body);
  }

  /**
   * POST /ia/relatorio-aluno
   * Gera um relatório de desenvolvimento de um aluno baseado em observações.
   *
   * Acesso: Professor, Unidade, Mantenedora, Developer
   */
  @Post('relatorio-aluno')
  @HttpCode(HttpStatus.OK)
  gerarRelatorioAluno(
    @Body()
    body: {
      nomeAluno: string;
      faixaEtaria: string;
      observacoes: string[];
      periodo: string;
    },
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.iaService.gerarRelatorioAluno(body);
  }

  /**
   * POST /ia/relatorio-consolidado-lgpd
   * Gera relatório consolidado com anonimização LGPD.
   * Busca dados reais do banco e envia apenas dados anonimizados para a IA.
   */
  @Post('relatorio-consolidado-lgpd')
  @HttpCode(HttpStatus.OK)
  gerarRelatorioConsolidadoLGPD(
    @Body() body: { childId: string; periodo: string },
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.iaService.gerarRelatorioConsolidadoLGPD({
      childId: body.childId,
      periodo: body.periodo,
    });
  }

  /**
   * POST /ia/gerar-plano-de-aula
   * Gera um plano de aula completo (vários dias), cobrindo objetivos reais
   * do framework pedagógico escolhido pela instituição — não uma atividade
   * solta, o planejamento inteiro de uma semana.
   *
   * Acesso: Professor, Unidade, Mantenedora, Developer
   */
  @Post('gerar-plano-de-aula')
  @HttpCode(HttpStatus.OK)
  gerarPlanoDeAula(
    @Body() dto: GerarPlanoDeAulaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.iaService.gerarPlanoDeAula(dto, user);
  }

  /**
   * POST /ia/revisar-planejamento
   * Revisa um planejamento real em modo somente leitura.
   * A resposta é uma recomendação estruturada e requer revisão humana.
   */
  @Post('revisar-planejamento')
  @HttpCode(HttpStatus.OK)
  revisarPlanejamento(
    @Body() body: { planningId: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.iaService.revisarPlanejamento(body.planningId, user);
  }

  /**
   * POST /ia/ideias-rapidas
   * Ideias rápidas e simples pro dia a dia — sem estrutura pesada, pra quando
   * o professor só precisa de inspiração imediata (brincadeira de transição,
   * acalmar a turma, preencher 10 minutos).
   *
   * Acesso: Professor, Unidade, Mantenedora, Developer
   */
  @Post('ideias-rapidas')
  @HttpCode(HttpStatus.OK)
  gerarIdeiasRapidas(
    @Body() dto: GerarIdeiasRapidasDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.iaService.gerarIdeiasRapidas(dto);
  }
}
