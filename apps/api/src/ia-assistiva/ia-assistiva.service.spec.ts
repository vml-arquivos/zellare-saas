import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiRateLimitError } from '../ai/services/gemini.service';
import { IaAssistivaService } from './ia-assistiva.service';

describe('IaAssistivaService — validação de plano gerado', () => {
  let service: IaAssistivaService;

  beforeEach(() => {
    service = new IaAssistivaService({} as any);
  });

  it('normaliza dias e preserva somente objetivos permitidos pela matriz', () => {
    const result = (service as any).validarPlanoGerado(
      {
        tituloDoPlano: 'Explorar sons',
        dias: [
          {
            dia: 99,
            objetivoTrabalhando: '  Explorar sons do ambiente  ',
            titulo: '  Escuta ativa  ',
            descricao: '  A turma identifica sons próximos.  ',
            materiais: ['  papel  ', 'lápis'],
            duracao: ' 30 minutos ',
          },
        ],
      },
      1,
      new Set(['Explorar sons do ambiente']),
    );

    expect(result).toEqual([
      {
        dia: 1,
        objetivoTrabalhando: 'Explorar sons do ambiente',
        titulo: 'Escuta ativa',
        descricao: 'A turma identifica sons próximos.',
        materiais: ['papel', 'lápis'],
        duracao: '30 minutos',
      },
    ]);
  });

  it('rejeita quantidade de dias diferente do pedido', () => {
    expect(() =>
      (service as any).validarPlanoGerado(
        { tituloDoPlano: 'Plano', dias: [] },
        2,
        new Set(['Objetivo']),
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('bloqueia revisão de planejamento de outra mantenedora', async () => {
    const prisma = {
      planning: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'planning-1',
          mantenedoraId: 'mantenedora-2',
          unitId: 'unit-2',
        }),
      },
    };
    const scopedService = new IaAssistivaService(prisma as any);

    await expect(
      scopedService.revisarPlanejamento('planning-1', {
        sub: 'user-1',
        email: 'teacher@example.com',
        mantenedoraId: 'mantenedora-1',
        unitId: 'unit-1',
        roles: [],
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejeita objetivo que não pertence à matriz permitida', () => {
    expect(() =>
      (service as any).validarPlanoGerado(
        {
          tituloDoPlano: 'Plano',
          dias: [
            {
              objetivoTrabalhando: 'Objetivo inventado',
              titulo: 'Atividade',
              descricao: 'Descrição',
              materiais: [],
              duracao: '20 minutos',
            },
          ],
        },
        1,
        new Set(['Objetivo autorizado']),
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('usa o modo aberto quando a data não possui objetivo curricular', async () => {
    const prisma = {
      frameworkObjective: {
        findUnique: jest.fn(),
      },
    };
    const gemini = {
      isEnabled: jest.fn().mockReturnValue(true),
      generateJSON: jest.fn().mockResolvedValue({
        titulo: 'Descobertas em roda',
        descricao: 'A turma explora uma proposta livre adequada à faixa etária.',
        intencionalidade: 'Favorecer interação e curiosidade.',
        materiais: ['objetos do cotidiano'],
        etapas: ['Explorar', 'Compartilhar'],
        duracao: '20 minutos',
        adaptacoes: 'Oferecer mediação visual.',
        registroSugerido: 'Registrar falas e participação.',
      }),
    };
    const scopedService = new IaAssistivaService(prisma as any, gemini as any);

    const result = await scopedService.gerarAtividade({
      faixaEtaria: 'EI02' as any,
      contextoAdicional: 'Poucos materiais disponíveis.',
    });

    expect(gemini.generateJSON).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      titulo: 'Descobertas em roda',
      campoDeExperiencia: '',
      objetivoBNCC: '',
      objetivoCurriculo: '',
      geradoPorIA: true,
    });
  });

  it('retorna 429 com mensagem operacional quando a quota do Gemini é atingida', async () => {
    const prisma = {
      frameworkObjective: {
        findUnique: jest.fn(),
      },
    };
    const gemini = {
      isEnabled: jest.fn().mockReturnValue(true),
      generateJSON: jest.fn().mockRejectedValue(new GeminiRateLimitError()),
    };
    const scopedService = new IaAssistivaService(prisma as any, gemini as any);

    const error = await scopedService.gerarAtividade({
      faixaEtaria: 'EI02' as any,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(error.message).toBe(
      'Limite de uso da IA atingido. Aguarde alguns minutos e tente novamente.',
    );
  });

  it('consolida anotações reais, exclui conteúdo sensível do prompt e persiste em revisão humana', async () => {
    const completion = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        relatorio: 'Síntese pedagógica baseada nas anotações do período.',
        pontosFortess: ['Participação observada'],
        sugestoes: ['Continuar mediações'],
      }) } }],
    });
    const prisma = {
      child: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'child-1',
          mantenedoraId: 'mantenedora-1',
          unitId: 'unit-1',
          firstName: 'Ana',
          lastName: 'Silva',
          dateOfBirth: new Date('2022-01-01'),
          enrollments: [{
            classroomId: 'classroom-1',
            classroom: { id: 'classroom-1', name: 'Turma A', unitId: 'unit-1', unit: { id: 'unit-1', name: 'Unidade A', mantenedoraId: 'mantenedora-1' } },
          }],
        }),
      },
      diaryEvent: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'diary-1', type: 'DESENVOLVIMENTO', title: 'Roda de leitura',
          description: 'Ana participou da história.', observations: 'Compartilhou ideias.',
          developmentNotes: 'Ampliou a narrativa.', behaviorNotes: null,
          eventDate: new Date('2026-03-10'), status: 'PUBLICADO',
        }]),
      },
      developmentObservation: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'obs-1', category: 'LINGUAGEM', date: new Date('2026-03-11'),
          behaviorDescription: null, socialInteraction: 'Interagiu com o grupo.', emotionalState: null,
          motorSkills: null, cognitiveSkills: null, languageSkills: 'Usou novas palavras.',
          learningProgress: 'Avanço observável.', planningParticipation: null, interests: 'Livros',
          challenges: null, recommendations: 'Manter rodas de leitura.', nextSteps: null,
        }]),
      },
      attendance: { count: jest.fn().mockResolvedValue(5) },
      familyCommunication: { count: jest.fn().mockResolvedValue(1) },
      atendimentoPais: { count: jest.fn().mockResolvedValue(1) },
      alertaAluno: { count: jest.fn().mockResolvedValue(0) },
      childEvidence: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'evidence-safe', sourceType: 'DIARY_EVENT', evidenceType: 'PEDAGOGICA', sensitivity: 'ORDINARIA', visibility: 'PEDAGOGICA', content: 'Registro pedagógico seguro.', capturedAt: new Date('2026-03-12') },
          { id: 'evidence-sensitive', sourceType: 'DEVELOPMENT_OBSERVATION', evidenceType: 'SAUDE', sensitivity: 'SAUDE', visibility: 'RESTRITA', content: 'Conteúdo de saúde que não deve ser enviado.', capturedAt: new Date('2026-03-12') },
        ]),
      },
      acompanhamentoNutricional: { findUnique: jest.fn().mockResolvedValue({ id: 'nutrition-1', ativo: true, motivoAcompanhamento: 'Restrição cadastrada' }) },
      developmentReport: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'report-1', status: 'EM_REVISAO' }),
      },
    };
    const service = new IaAssistivaService(prisma as any);
    (service as any)._cliente = { chat: { completions: { create: completion } } };

    const result = await service.gerarRelatorioConsolidadoLGPD({
      childId: 'child-1',
      periodo: '1º Trimestre 2026',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-05-31T23:59:59.999Z',
    }, {
      sub: 'teacher-1',
      email: 'teacher@example.com',
      mantenedoraId: 'mantenedora-1',
      unitId: 'unit-1',
      roles: [{ level: 'PROFESSOR' }],
    } as any);

    expect(result).toMatchObject({ reportId: 'report-1', status: 'EM_REVISAO', anonimizado: true, requerRevisaoHumana: true });
    expect(result.fontes).toMatchObject({ diarioBordo: 1, observacoesDesenvolvimento: 1, camadaEvidencias: 2, frequencia: 5, comunicacoesFamilia: 1, atendimentosPais: 1, casosNutricionaisAtivos: 1 });
    expect(prisma.developmentReport.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'EM_REVISAO', authorId: 'teacher-1', childId: 'child-1' }) }));
    const prompt = completion.mock.calls[0][0].messages[1].content as string;
    expect(prompt).toContain('Registro pedagógico seguro.');
    expect(prompt).not.toContain('Conteúdo de saúde que não deve ser enviado.');
  });

  it('usa o Gemini nativo para gerar atividade e preserva o objetivo curricular', async () => {
    const prisma = {
      frameworkObjective: {
        findUnique: jest.fn(),
      },
    };
    const gemini = {
      isEnabled: jest.fn().mockReturnValue(true),
      generateJSON: jest.fn().mockResolvedValue({
        titulo: 'Sons do quintal',
        descricao: 'A turma explora sons próximos.',
        intencionalidade: 'Ampliar a escuta e a curiosidade.',
        materiais: ['potes', 'folhas'],
        etapas: ['Explorar', 'Compartilhar'],
        duracao: '30 minutos',
        adaptacoes: 'Oferecer apoio visual.',
        registroSugerido: 'Registrar falas e descobertas.',
      }),
    };
    const scopedService = new IaAssistivaService(prisma as any, gemini as any);

    const result = await scopedService.gerarAtividade({
      campoDeExperiencia: 'Traços, sons, cores e formas',
      objetivoBNCC: 'Explorar sons do ambiente',
      objetivoCurriculo: 'Currículo institucional 2026',
      faixaEtaria: 'EI03' as any,
    });

    expect(gemini.generateJSON).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      titulo: 'Sons do quintal',
      objetivoBNCC: 'Explorar sons do ambiente',
      objetivoCurriculo: 'Currículo institucional 2026',
      geradoPorIA: true,
    });
  });
});
