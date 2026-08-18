import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { GerarAtividadeDto, FaixaEtaria, TipoAtividade } from './dto/gerar-atividade.dto';
import { GerarPlanoDeAulaDto } from './dto/gerar-plano-de-aula.dto';
import { GerarIdeiasRapidasDto } from './dto/gerar-ideias-rapidas.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { canAccessUnit } from '../common/utils/can-access-unit';
import { GeminiService } from '../ai/services/gemini.service';

export interface AtividadeGerada {
  titulo: string;
  descricao: string;
  intencionalidade: string;
  materiais: string[];
  etapas: string[];
  duracao: string;
  adaptacoes: string;
  registroSugerido: string;
  campoDeExperiencia: string;
  objetivoBNCC: string;
  objetivoCurriculo: string;
  faixaEtaria: string;
  geradoPorIA: true;
}

const LABELS_FAIXA: Record<FaixaEtaria, string> = {
  [FaixaEtaria.EI01]: 'Bebês (0 a 1 ano e 6 meses)',
  [FaixaEtaria.EI02]: 'Crianças Bem Pequenas (1 ano e 7 meses a 3 anos e 11 meses)',
  [FaixaEtaria.EI03]: 'Crianças Pequenas (4 anos a 5 anos e 11 meses)',
};

const LABELS_TIPO: Record<TipoAtividade, string> = {
  [TipoAtividade.RODA_DE_CONVERSA]: 'Roda de Conversa',
  [TipoAtividade.EXPLORACAO_SENSORIAL]: 'Exploração Sensorial',
  [TipoAtividade.ATIVIDADE_PLASTICA]: 'Atividade Plástica',
  [TipoAtividade.BRINCADEIRA_DIRIGIDA]: 'Brincadeira Dirigida',
  [TipoAtividade.LEITURA_COMPARTILHADA]: 'Leitura Compartilhada',
  [TipoAtividade.MUSICA_E_MOVIMENTO]: 'Música e Movimento',
  [TipoAtividade.JOGO_SIMBOLICO]: 'Jogo Simbólico',
  [TipoAtividade.INVESTIGACAO]: 'Investigação',
  [TipoAtividade.SEQUENCIA_DIDATICA]: 'Sequência Didática',
  [TipoAtividade.LIVRE]: 'Livre',
};

// ============================================================================
// CONFIGURAÇÃO DO PROVEDOR DE IA
// ============================================================================
// O sistema usa a API do Google Gemini como padrão, via interface compatível
// com OpenAI. Para trocar o provedor, basta alterar as variáveis de ambiente
// no Coolify — sem necessidade de alterar o código.
//
// Variáveis de ambiente:
//   GEMINI_API_KEY  → Chave da API do Google AI Studio (obrigatória para IA)
//   GEMINI_BASE_URL → URL base (padrão: https://generativelanguage.googleapis.com/v1beta/openai/)
//   GEMINI_MODEL    → Modelo (padrão: gemini-3.6-flash)
//
// Compatibilidade retroativa (se GEMINI_API_KEY não estiver definida, tenta OPENAI_API_KEY):
//   OPENAI_API_KEY  → Chave da OpenAI (fallback)
//   OPENAI_BASE_URL → URL base da OpenAI (fallback)
//   OPENAI_MODEL    → Modelo da OpenAI (fallback)
// ============================================================================

@Injectable()
export class IaAssistivaService {
  private readonly logger = new Logger(IaAssistivaService.name);
  // Inicialização LAZY: o cliente só é criado quando realmente for usado.
  // Isso garante que o servidor sobe normalmente mesmo sem chave de IA configurada.
  private _cliente: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gemini?: GeminiService,
  ) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      this.logger.log(
        'IA Assistiva: GEMINI_API_KEY detectada — usando Google Gemini como provedor de IA.',
      );
    } else if (openaiKey) {
      this.logger.log(
        'IA Assistiva: OPENAI_API_KEY detectada — usando OpenAI como provedor de IA (fallback).',
      );
    } else {
      this.logger.warn(
        'IA Assistiva: Nenhuma chave de IA configurada (GEMINI_API_KEY ou OPENAI_API_KEY). ' +
        'O servidor funciona normalmente. Endpoints de IA retornarão 503 até uma chave ser adicionada.',
      );
    }
  }

  /**
   * Retorna o cliente de IA (lazy init).
   * Prioridade: Gemini > OpenAI
   * Lança ServiceUnavailableException se nenhuma chave estiver configurada.
   */
  private getCliente(): OpenAI {
    if (this._cliente) return this._cliente;

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      // Gemini via API compatível com OpenAI
      this._cliente = new OpenAI({
        apiKey: geminiKey,
        baseURL:
          process.env.GEMINI_BASE_URL ||
          'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
      return this._cliente;
    }

    if (openaiKey) {
      // OpenAI como fallback
      this._cliente = new OpenAI({
        apiKey: openaiKey,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
      });
      return this._cliente;
    }

    throw new ServiceUnavailableException(
      'O módulo de IA não está configurado neste ambiente. ' +
      'Adicione a variável GEMINI_API_KEY nas configurações do servidor no Coolify.',
    );
  }

  /**
   * Retorna o nome do modelo a ser usado.
   * Prioridade: GEMINI_MODEL > OPENAI_MODEL > gemini-3.6-flash (padrão)
   */
  private getModelo(): string {
    return (
      process.env.GEMINI_MODEL ||
      process.env.OPENAI_MODEL ||
      'gemini-3.6-flash'
    );
  }

  /**
   * Gera uma atividade pedagógica completa alinhada à Sequência Piloto 2026.
   *
   * REGRA DE OURO: O Campo de Experiência, o Objetivo BNCC e o Objetivo do
   * Currículo em Movimento são FIXOS e vêm da Sequência Piloto. A IA APENAS
   * cria a atividade/experiência para atingir esses objetivos.
   */
  /**
   * Resolve o objetivo pedagógico a partir de QUALQUER framework plugável
   * (frameworkObjectiveId) ou, por compatibilidade, dos campos BNCC/DF
   * informados na mão (caminho legado, usado pela COCRIS hoje).
   */
  private async resolverObjetivoPedagogico(dto: {
    frameworkObjectiveId?: string;
    campoDeExperiencia?: string;
    objetivoBNCC?: string;
    objetivoCurriculo?: string;
  }): Promise<{ campoDeExperiencia: string; objetivoBNCC: string; objetivoCurriculo: string }> {
    if (dto.frameworkObjectiveId) {
      const objetivo = await this.prisma.frameworkObjective.findUnique({
        where: { id: dto.frameworkObjectiveId },
        include: { dimension: true, framework: true },
      });
      if (!objetivo) {
        throw new BadRequestException('Objetivo de framework pedagógico não encontrado');
      }
      return {
        campoDeExperiencia: objetivo.dimension.name,
        objetivoBNCC: objetivo.text,
        objetivoCurriculo: `${objetivo.framework.name}${objetivo.code ? ` (${objetivo.code})` : ''}`,
      };
    }
    // Modo legado: aceita objetivo curricular parcial quando a matriz do dia
    // não possui referência DF/institucional cadastrada. Nenhum código ou
    // objetivo curricular é inventado; o prompt sinaliza o modo aberto.
    if (dto.campoDeExperiencia || dto.objetivoBNCC || dto.objetivoCurriculo) {
      return {
        campoDeExperiencia: dto.campoDeExperiencia?.trim() ?? '',
        objetivoBNCC: dto.objetivoBNCC?.trim() ?? '',
        objetivoCurriculo: dto.objetivoCurriculo?.trim() ?? '',
      };
    }

    // Modo de planejamento aberto: permitido quando a data ainda não tem
    // objetivo curricular cadastrado. A IA cria apenas uma sugestão didática
    // por faixa etária/contexto, sem atribuir BNCC ou código inexistente.
    return {
      campoDeExperiencia: '',
      objetivoBNCC: '',
      objetivoCurriculo: '',
    };
  }

  async gerarAtividade(dto: GerarAtividadeDto): Promise<AtividadeGerada> {
    const objetivo = await this.resolverObjetivoPedagogico(dto);
    const faixaLabel = dto.faixaEtaria
      ? LABELS_FAIXA[dto.faixaEtaria] || dto.faixaEtaria
      : dto.ageRangeMeses !== undefined
        ? `${dto.ageRangeMeses} meses`
        : 'não informada';
    const tipoLabel = dto.tipoAtividade
      ? LABELS_TIPO[dto.tipoAtividade]
      : 'à sua escolha (sugira o mais adequado)';

    const possuiObjetivoCurricular = Boolean(
      objetivo.campoDeExperiencia && objetivo.objetivoBNCC,
    );
    const contextoCurricular = possuiObjetivoCurricular
      ? `## OBJETIVO PEDAGÓGICO A CUMPRIR (NÃO ALTERE — vem do currículo escolhido pela instituição)
- **Área/Campo:** ${objetivo.campoDeExperiencia}
- **Objetivo:** ${objetivo.objetivoBNCC}
- **Referência curricular:** ${objetivo.objetivoCurriculo || 'Não informado pela instituição'}

## DADOS DA TURMA`
      : `## MODO DE PLANEJAMENTO ABERTO
A data não possui objetivo curricular cadastrado. Crie uma sugestão pedagógica
adequada à faixa etária e ao contexto informado, mas NÃO invente códigos BNCC,
nomes de currículo ou objetivos oficiais. Deixe as referências curriculares
em branco na resposta.

## DADOS DA TURMA`;

    const prompt = `Você é uma especialista em Educação Infantil (0 a 6 anos).

Sua tarefa é criar UMA atividade pedagógica completa e detalhada para professores de Educação Infantil.

${contextoCurricular}
- **Faixa Etária:** ${faixaLabel}
- **Tipo de Atividade:** ${tipoLabel}
- **Número de Crianças:** ${dto.numeroCriancas ? dto.numeroCriancas + ' crianças' : 'não informado'}
${dto.contextoAdicional ? `- **Contexto Adicional:** ${dto.contextoAdicional}` : ''}

## INSTRUÇÕES
1. Crie uma atividade CRIATIVA, LÚDICA e ADEQUADA à faixa etária informada.
2. A atividade deve ser DIRETAMENTE alinhada à área/campo e ao objetivo acima.
3. Use linguagem simples e direta, como se estivesse escrevendo para o professor executar em sala.
4. Considere recursos básicos, acessíveis à maioria das instituições.
5. Inclua adaptações para crianças com necessidades especiais.

## FORMATO DE RESPOSTA (JSON VÁLIDO — sem markdown, sem explicações fora do JSON)
{
  "titulo": "Título criativo da atividade",
  "descricao": "Descrição geral da atividade em 2-3 frases",
  "intencionalidade": "O que o professor pretende alcançar com esta atividade (1-2 frases)",
  "materiais": ["material 1", "material 2", "material 3"],
  "etapas": [
    "1. Primeira etapa detalhada",
    "2. Segunda etapa detalhada",
    "3. Terceira etapa detalhada"
  ],
  "duracao": "Duração estimada (ex: 30 a 40 minutos)",
  "adaptacoes": "Sugestões de adaptação para crianças com necessidades especiais ou diferentes ritmos",
  "registroSugerido": "Como o professor pode registrar e documentar esta atividade (fotos, portfólio, diário, etc.)"
}`;

    try {
      type AtividadeGeradaPayload = Pick<
        AtividadeGerada,
        'titulo' | 'descricao' | 'intencionalidade' | 'materiais' | 'etapas' |
        'duracao' | 'adaptacoes' | 'registroSugerido'
      >;
      let atividade: AtividadeGeradaPayload;

      if (this.gemini?.isEnabled()) {
        // Caminho principal: SDK nativo do Gemini com resposta JSON estruturada.
        // A chave permanece exclusivamente no servidor e evitamos divergência
        // entre o modelo nativo e o endpoint OpenAI-compatible.
        atividade = await this.gemini.generateJSON<AtividadeGeradaPayload>(
          prompt,
          'Você é uma especialista em Educação Infantil. Retorne apenas um JSON válido, sem markdown e sem texto adicional.',
        );
      } else {
        // Fallback legado para ambientes que ainda usam OpenAI-compatible.
        const cliente = this.getCliente();
        const resposta = await cliente.chat.completions.create({
          model: this.getModelo(),
          messages: [
            {
              role: 'system',
              content:
                'Você é uma especialista em Educação Infantil. Responda APENAS com JSON válido, sem markdown, sem texto adicional.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });

        const conteudo = resposta.choices[0]?.message?.content;
        if (!conteudo) {
          throw new ServiceUnavailableException(
            'A IA não retornou conteúdo. Tente novamente.',
          );
        }

        const jsonLimpo = conteudo
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        atividade = JSON.parse(jsonLimpo) as AtividadeGeradaPayload;
      }

      // Garantir que referências curriculares existentes sejam preservadas;
      // no modo aberto, elas permanecem vazias para evitar falsa atribuição.
      return {
        ...atividade,
        campoDeExperiencia: objetivo.campoDeExperiencia,
        objetivoBNCC: objetivo.objetivoBNCC,
        objetivoCurriculo: objetivo.objetivoCurriculo,
        faixaEtaria: faixaLabel,
        geradoPorIA: true,
      };
    } catch (error) {
      this.logger.error('Erro ao gerar atividade com IA:', error);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Serviço de IA temporariamente indisponível. Tente novamente em instantes.',
      );
    }
  }

  /**
   * Gera sugestões de microgestos pedagógicos para um aluno específico
   * baseado em observações do professor.
   */
  async gerarMicrogestos(params: {
    nomeAluno: string;
    faixaEtaria: string;
    observacoes: string;
    campoDeExperiencia: string;
  }): Promise<{ microgestos: string[]; justificativa: string }> {
    const cliente = this.getCliente();

    const prompt = `Você é uma especialista em Educação Infantil e desenvolvimento infantil.

Com base nas observações abaixo sobre uma criança, sugira 3 a 5 MICROGESTOS PEDAGÓGICOS que o professor pode fazer para apoiar o desenvolvimento desta criança.

**Criança:** ${params.nomeAluno}
**Faixa Etária:** ${params.faixaEtaria}
**Campo de Experiência em foco:** ${params.campoDeExperiencia}
**Observações do Professor:** ${params.observacoes}

Microgestos são ações pequenas, intencionais e imediatas que o professor faz durante a rotina para apoiar o desenvolvimento individual da criança.

Responda em JSON:
{
  "microgestos": [
    "Microgesto 1 — ação específica e concreta",
    "Microgesto 2",
    "Microgesto 3"
  ],
  "justificativa": "Breve justificativa pedagógica para estas sugestões"
}`;

    try {
      const resposta = await cliente.chat.completions.create({
        model: this.getModelo(),
        messages: [
          {
            role: 'system',
            content:
              'Você é especialista em Educação Infantil brasileira. Responda APENAS com JSON válido.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 800,
      });

      const conteudo = resposta.choices[0]?.message?.content;
      if (!conteudo) {
        throw new ServiceUnavailableException('IA sem resposta. Tente novamente.');
      }
      const jsonLimpo = conteudo
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(jsonLimpo);
    } catch (error) {
      this.logger.error('Erro ao gerar microgestos:', error);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Serviço de IA temporariamente indisponível.',
      );
    }
  }

  // ============================================================================
  // MOTOR DE IA ASSISTIVA LGPD
  // ============================================================================

  /**
   * Anonimiza nome para conformidade LGPD.
   */
  private anonimizarNome(_nome: string, codigo: string): string {
    return `Aluno(a) ${codigo}`;
  }

  /**
   * Gera relatório consolidado de desenvolvimento com anonimização LGPD.
   * Busca dados reais do banco (Diário de Bordo + microgestos) e envia
   * apenas dados anonimizados para a IA.
   */
  async gerarRelatorioConsolidadoLGPD(params: {
    childId: string;
    periodo: string;
  }): Promise<{
    relatorio: string;
    pontosFortess: string[];
    sugestoes: string[];
    anonimizado: boolean;
    totalObservacoes: number;
    codigoAnonimizado: string;
  }> {
    // 1. Buscar dados da criança
    const crianca = await this.prisma.child.findUnique({
      where: { id: params.childId },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
    });
    if (!crianca) throw new ServiceUnavailableException('Criança não encontrada.');

    // 2. Código anônimo determinístico (baseado no ID, nunca no nome)
    const codigoAnonimizado = `C-${params.childId.slice(-6).toUpperCase()}`;
    const nomeAnonimizado = this.anonimizarNome(
      `${crianca.firstName} ${crianca.lastName}`,
      codigoAnonimizado,
    );

    // 3. Calcular faixa etária a partir de dateOfBirth
    let faixaEtaria = 'Criança Pequena (4 a 5 anos)';
    if (crianca.dateOfBirth) {
      const idadeMeses = Math.floor(
        (Date.now() - new Date(crianca.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
      );
      if (idadeMeses <= 18) faixaEtaria = 'Bebê (0 a 1 ano e 6 meses)';
      else if (idadeMeses <= 47) faixaEtaria = 'Criança Bem Pequena (1a7m a 3a11m)';
      else faixaEtaria = 'Criança Pequena (4 a 5 anos e 11 meses)';
    }

    // 4. Buscar observações do Diário de Bordo
    // Campos reais: description, observations, developmentNotes, behaviorNotes
    const diaryEvents = await this.prisma.diaryEvent.findMany({
      where: { childId: params.childId },
      select: {
        description: true,
        observations: true,
        developmentNotes: true,
        behaviorNotes: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // 5. Montar observações anonimizadas (remover nomes próprios)
    const observacoes: string[] = [];
    const regexNome = new RegExp(`${crianca.firstName}|${crianca.lastName}`, 'gi');
    for (const ev of diaryEvents) {
      const campos = [ev.description, ev.observations, ev.developmentNotes, ev.behaviorNotes].filter(Boolean) as string[];
      for (const campo of campos) {
        const obs = campo
          .replace(/\b[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}\b/g, nomeAnonimizado)
          .replace(regexNome, nomeAnonimizado);
        observacoes.push(obs);
      }
    }

    if (observacoes.length === 0) {
      throw new ServiceUnavailableException(
        'Não há observações suficientes. Registre pelo menos uma entrada no Diário de Bordo.',
      );
    }

    // 6. Chamar IA com dados 100% anonimizados
    const resultado = await this.gerarRelatorioAluno({
      nomeAluno: nomeAnonimizado,
      faixaEtaria,
      observacoes: observacoes.slice(0, 20),
      periodo: params.periodo,
    });

    return {
      ...resultado,
      anonimizado: true,
      totalObservacoes: observacoes.length,
      codigoAnonimizado,
    };
  }

  /**
   * Gera um relatório de desenvolvimento de um aluno baseado em observações
   * do diário do professor.
   */
  async gerarRelatorioAluno(params: {
    nomeAluno: string;
    faixaEtaria: string;
    observacoes: string[];
    periodo: string;
  }): Promise<{ relatorio: string; pontosFortess: string[]; sugestoes: string[] }> {
    const cliente = this.getCliente();
    const observacoesTexto = params.observacoes
      .map((o, i) => `${i + 1}. ${o}`)
      .join('\n');

    const prompt = `Você é uma especialista em Educação Infantil e avaliação formativa.

Com base nas observações do professor durante o período indicado, elabore um relatório de desenvolvimento da criança.

**Criança:** ${params.nomeAluno}
**Faixa Etária:** ${params.faixaEtaria}
**Período:** ${params.periodo}
**Observações registradas:**
${observacoesTexto}

Responda em JSON:
{
  "relatorio": "Texto do relatório em linguagem acessível para os responsáveis (3-4 parágrafos)",
  "pontosFortess": ["Ponto forte 1", "Ponto forte 2", "Ponto forte 3"],
  "sugestoes": ["Sugestão de continuidade 1", "Sugestão 2"]
}`;

    try {
      const resposta = await cliente.chat.completions.create({
        model: this.getModelo(),
        messages: [
          {
            role: 'system',
            content:
              'Você é especialista em Educação Infantil brasileira. Responda APENAS com JSON válido.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 1200,
      });

      const conteudo = resposta.choices[0]?.message?.content;
      if (!conteudo) {
        throw new ServiceUnavailableException('IA sem resposta. Tente novamente.');
      }
      const jsonLimpo = conteudo
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(jsonLimpo);
    } catch (error) {
      this.logger.error('Erro ao gerar relatório:', error);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Serviço de IA temporariamente indisponível.',
      );
    }
  }

  /**
   * Gera um PLANO DE AULA completo, cobrindo vários dias letivos, cada um
   * ligado a um objetivo real do framework pedagógico escolhido pela
   * instituição. É o gerador "de verdade" — não uma atividade solta, mas
   * o planejamento inteiro de uma semana, pronto pra virar Planning.
   */
  async gerarPlanoDeAula(dto: GerarPlanoDeAulaDto, user?: JwtPayload) {
    const cliente = this.getCliente();

    const objetivos = await this.prisma.frameworkObjective.findMany({
      where: {
        id: { in: dto.frameworkObjectiveIds },
        ...(user && {
          framework: {
            isActive: true,
            OR: [
              { mantenedoraId: user.mantenedoraId },
              { mantenedoraId: null },
            ],
          },
        }),
      },
      include: { dimension: true, framework: true },
    });
    if (objetivos.length === 0) {
      throw new BadRequestException('Nenhum objetivo de framework pedagógico encontrado para os IDs informados');
    }

    let materialBase = '';
    if (dto.contentUploadId) {
      const upload = await this.prisma.institutionContentUpload.findFirst({
        where: {
          id: dto.contentUploadId,
          ...(user && {
            mantenedoraId: user.mantenedoraId,
            status: 'APROVADO',
          }),
        },
      });
      if (upload?.extractedData) {
        materialBase = `\n## MATERIAL DE REFERÊNCIA DA PRÓPRIA INSTITUIÇÃO (use como inspiração de estilo e conteúdo)\n${JSON.stringify(upload.extractedData)}\n`;
      }
    }

    const objetivosTexto = objetivos
      .map((o) => `- [${o.framework.name} / ${o.dimension.name}]: ${o.text}`)
      .join('\n');

    const prompt = `Você é uma especialista em Educação Infantil (0 a 6 anos), criando o planejamento semanal de uma turma.

## OBJETIVOS PEDAGÓGICOS A COBRIR NO PLANO (do currículo escolhido pela instituição)
${objetivosTexto}

${dto.tema ? `## TEMA/PROJETO DA SEMANA\n${dto.tema}\n` : ''}
## DADOS DA TURMA
- **Idade:** ${dto.ageRangeMeses} meses
- **Quantidade de dias letivos a planejar:** ${dto.quantidadeDias}
- **Número de crianças:** ${dto.numeroCriancas ?? 'não informado'}
${dto.contextoAdicional ? `- **Contexto adicional:** ${dto.contextoAdicional}` : ''}
${materialBase}
## INSTRUÇÕES
1. Distribua os objetivos acima ao longo dos ${dto.quantidadeDias} dias — pode repetir um objetivo em mais de um dia, mas cubra todos.
2. Cada dia tem UMA atividade principal, criativa e executável com recursos básicos.
3. Mantenha uma progressão que faça sentido ao longo da semana (não repita a mesma atividade dois dias seguidos).
4. Linguagem direta, para o professor executar.

## FORMATO DE RESPOSTA (JSON VÁLIDO — sem markdown)
{
  "tituloDoPlano": "Nome do plano/semana",
  "dias": [
    {
      "dia": 1,
      "objetivoTrabalhando": "qual objetivo da lista acima este dia cobre",
      "titulo": "Título da atividade do dia",
      "descricao": "Descrição em 2-3 frases",
      "materiais": ["material 1", "material 2"],
      "duracao": "ex: 40 minutos"
    }
  ]
}`;

    try {
      const resposta = await cliente.chat.completions.create({
        model: this.getModelo(),
        messages: [
          { role: 'system', content: 'Você é uma especialista em Educação Infantil. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });
      const conteudo = resposta.choices[0]?.message?.content;
      if (!conteudo) throw new ServiceUnavailableException('A IA não retornou conteúdo. Tente novamente.');
      const jsonLimpo = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const plano = JSON.parse(jsonLimpo) as {
        tituloDoPlano?: unknown;
        dias?: Array<Record<string, unknown>>;
      };
      const objetivosPermitidos = new Set(
        objetivos.map((objetivo) => objetivo.text.trim()),
      );
      const diasValidados = this.validarPlanoGerado(
        plano,
        dto.quantidadeDias,
        objetivosPermitidos,
      );

      return {
        ...plano,
        dias: diasValidados,
        frameworkObjectiveIds: dto.frameworkObjectiveIds,
        geradoPorIA: true,
      };
    } catch (error) {
      this.logger.error('Erro ao gerar plano de aula com IA:', error);
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Serviço de IA temporariamente indisponível. Tente novamente em instantes.');
    }
  }

  /**
   * Revisa um planejamento real em modo somente leitura.
   * A resposta é uma recomendação estruturada para o professor/coordenação;
   * nenhum campo do Planning é alterado automaticamente.
   */
  async revisarPlanejamento(planningId: string, user: JwtPayload) {
    if (!planningId?.trim()) {
      throw new BadRequestException('planningId é obrigatório.');
    }

    const planning = await this.prisma.planning.findUnique({
      where: { id: planningId },
      include: {
        classroom: { include: { unit: true } },
        curriculumMatrix: {
          include: {
            entries: {
              orderBy: { date: 'asc' },
              take: 30,
              include: {
                frameworkObjective: {
                  include: { dimension: true, framework: true },
                },
              },
            },
          },
        },
      },
    });

    if (!planning) {
      throw new NotFoundException(`Planejamento "${planningId}" não encontrado.`);
    }
    if (planning.mantenedoraId !== user.mantenedoraId) {
      throw new ForbiddenException('Acesso negado ao planejamento.');
    }
    await this.assertUnitAccess(user, planning.unitId);

    const cliente = this.getCliente();
    const entries = planning.curriculumMatrix?.entries ?? [];
    const objectives = entries
      .map((entry) => entry.frameworkObjective)
      .filter(Boolean)
      .map((objective) => ({
        framework: objective!.framework.name,
        dimension: objective!.dimension.name,
        code: objective!.code,
        text: objective!.text,
      }));

    const prompt = `Você é uma coordenadora pedagógica experiente em Educação Infantil.

Revise o planejamento abaixo com foco em coerência, intencionalidade, inclusão, viabilidade e alinhamento curricular. Não faça diagnóstico de crianças, não invente fatos e não altere o planejamento. Retorne somente recomendações para revisão humana.

## PLANEJAMENTO REAL
- ID: ${planning.id}
- Título: ${planning.title}
- Status: ${planning.status}
- Turma: ${planning.classroom.name}
- Faixa etária: ${planning.classroom.ageGroupMin} a ${planning.classroom.ageGroupMax} meses
- Período: ${planning.startDate.toISOString()} até ${planning.endDate.toISOString()}
- Descrição: ${planning.description ?? ''}
- Conteúdo pedagógico: ${JSON.stringify(planning.pedagogicalContent ?? planning.activities ?? {})}
- Avaliação: ${planning.evaluation ?? ''}

## OBJETIVOS CURRICULARES ENCONTRADOS
${JSON.stringify(objectives)}

## FORMATO JSON OBRIGATÓRIO
{
  "resumo": "Síntese curta da qualidade do planejamento",
  "pontosFortes": ["ponto observável"],
  "lacunas": ["lacuna observável ou []"],
  "sugestoes": ["sugestão prática e revisável"],
  "perguntasParaProfessor": ["pergunta de reflexão"],
  "alertas": ["alerta somente quando houver evidência no planejamento ou []"]
}`;

    try {
      const resposta = await cliente.chat.completions.create({
        model: this.getModelo(),
        messages: [
          {
            role: 'system',
            content:
              'Você é uma coordenadora pedagógica. Responda apenas com JSON válido e nunca invente dados sobre crianças.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 1800,
      });
      const conteudo = resposta.choices[0]?.message?.content;
      if (!conteudo) {
        throw new ServiceUnavailableException('A IA não retornou uma revisão. Tente novamente.');
      }
      const revisao = JSON.parse(
        conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim(),
      ) as Record<string, unknown>;
      const listas = ['pontosFortes', 'lacunas', 'sugestoes', 'perguntasParaProfessor', 'alertas'];
      if (
        typeof revisao.resumo !== 'string' ||
        !revisao.resumo.trim() ||
        listas.some(
          (campo) =>
            !Array.isArray(revisao[campo]) ||
            (revisao[campo] as unknown[]).some((item) => typeof item !== 'string'),
        )
      ) {
        throw new ServiceUnavailableException('A IA retornou uma revisão fora do formato esperado.');
      }

      return {
        planningId: planning.id,
        planningStatus: planning.status,
        reviewedAt: new Date().toISOString(),
        fonte: {
          classroomId: planning.classroomId,
          curriculumMatrixId: planning.curriculumMatrixId,
          objectivesCount: objectives.length,
        },
        revisao: {
          ...revisao,
          resumo: revisao.resumo.trim(),
        },
        geradoPorIA: true,
        requerRevisaoHumana: true,
      };
    } catch (error) {
      this.logger.error('Erro ao revisar planejamento com IA:', error);
      if (error instanceof ServiceUnavailableException || error instanceof ForbiddenException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Serviço de IA temporariamente indisponível. Tente novamente em instantes.',
      );
    }
  }

  private async assertUnitAccess(user: JwtPayload, targetUnitId: string): Promise<void> {
    const allowed = await canAccessUnit(user, targetUnitId, async ({ userId }) => {
      const scopes = await this.prisma.userRoleUnitScope.findMany({
        where: { userRole: { userId, isActive: true } },
        select: { unitId: true },
      });
      return scopes.map((scope) => scope.unitId);
    });
    if (!allowed) {
      throw new ForbiddenException('Acesso negado ao escopo da unidade.');
    }
  }

  private validarPlanoGerado(
    plano: { tituloDoPlano?: unknown; dias?: Array<Record<string, unknown>> },
    quantidadeDias: number,
    objetivosPermitidos: Set<string>,
  ): Array<Record<string, unknown>> {
    if (typeof plano.tituloDoPlano !== 'string' || !plano.tituloDoPlano.trim()) {
      throw new ServiceUnavailableException(
        'A IA retornou um plano sem título válido. Tente novamente.',
      );
    }

    if (!Array.isArray(plano.dias) || plano.dias.length !== quantidadeDias) {
      throw new ServiceUnavailableException(
        `A IA retornou ${plano.dias?.length ?? 0} dias, mas eram esperados ${quantidadeDias}. Tente novamente.`,
      );
    }

    return plano.dias.map((dia, index) => {
      const objetivo = dia.objetivoTrabalhando;
      const titulo = dia.titulo;
      const descricao = dia.descricao;
      const materiais = dia.materiais;
      const duracao = dia.duracao;

      if (
        typeof objetivo !== 'string' ||
        !objetivosPermitidos.has(objetivo.trim()) ||
        typeof titulo !== 'string' ||
        !titulo.trim() ||
        typeof descricao !== 'string' ||
        !descricao.trim() ||
        !Array.isArray(materiais) ||
        materiais.some((item) => typeof item !== 'string') ||
        typeof duracao !== 'string' ||
        !duracao.trim()
      ) {
        throw new ServiceUnavailableException(
          `A IA retornou dados inválidos no dia ${index + 1}. Tente novamente.`,
        );
      }

      return {
        ...dia,
        dia: index + 1,
        objetivoTrabalhando: objetivo.trim(),
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        materiais: materiais.map((item) => item.trim()),
        duracao: duracao.trim(),
      };
    });
  }

  /**
   * Ideias RÁPIDAS — sem estrutura pesada, pra quando o professor só precisa
   * de inspiração imediata no meio do dia (brincadeira de transição, acalmar
   * a turma, preencher 10 minutos). É o caminho mais simples do sistema.
   */
  async gerarIdeiasRapidas(dto: GerarIdeiasRapidasDto) {
    const cliente = this.getCliente();
    const quantidade = dto.quantidade ?? 5;

    const prompt = `Você é uma educadora infantil experiente, dando ideias RÁPIDAS pra outra professora que precisa de algo AGORA, sem tempo pra planejar.

## O QUE ELA PRECISA
"${dto.necessidade}"
${dto.ageRangeMeses !== undefined ? `\n## IDADE DA TURMA\n${dto.ageRangeMeses} meses` : ''}

## INSTRUÇÕES
Dê ${quantidade} ideias curtas, práticas, sem precisar de material elaborado ou preparação prévia. Uma frase de descrição cada, direto ao ponto.

## FORMATO (JSON VÁLIDO — sem markdown)
{
  "ideias": [
    { "titulo": "Nome curto da ideia", "descricao": "Como fazer, em 1 frase direta", "duracaoEstimada": "ex: 5 min" }
  ]
}`;

    try {
      const resposta = await cliente.chat.completions.create({
        model: this.getModelo(),
        messages: [
          { role: 'system', content: 'Você dá ideias rápidas e práticas pra professoras de educação infantil. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.85,
        max_tokens: 900,
      });
      const conteudo = resposta.choices[0]?.message?.content;
      if (!conteudo) throw new ServiceUnavailableException('A IA não retornou conteúdo. Tente novamente.');
      const jsonLimpo = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonLimpo);
    } catch (error) {
      this.logger.error('Erro ao gerar ideias rápidas com IA:', error);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Serviço de IA temporariamente indisponível. Tente novamente em instantes.');
    }
  }
}
