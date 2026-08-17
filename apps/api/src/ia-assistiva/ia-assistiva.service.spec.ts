import { ServiceUnavailableException } from '@nestjs/common';
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
});
