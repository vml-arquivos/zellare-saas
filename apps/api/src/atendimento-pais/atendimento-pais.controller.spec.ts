import { Test, TestingModule } from '@nestjs/testing';
import { AtendimentoPaisController } from './atendimento-pais.controller';
import { AtendimentoPaisService } from './atendimento-pais.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TipoAtendimento, StatusAtendimento } from '@prisma/client';

describe('AtendimentoPaisController', () => {
  let controller: AtendimentoPaisController;
  let service: AtendimentoPaisService;

  const mockAtendimentoPaisService = {
    criar: jest.fn(),
    listar: jest.fn(),
    atualizarStatus: jest.fn(),
  };

  const mockUser: JwtPayload = {
    sub: 'user-prof-1',
    email: 'teacher-a@example.invalid',
    mantenedoraId: 'mant-001',
    unitId: 'unit-001',
    roles: [{ roleId: 'r1', level: 'PROFESSOR', type: 'PROFESSOR', unitScopes: [] }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AtendimentoPaisController],
      providers: [
        { provide: AtendimentoPaisService, useValue: mockAtendimentoPaisService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AtendimentoPaisController>(AtendimentoPaisController);
    service = module.get<AtendimentoPaisService>(AtendimentoPaisService);
  });

  afterEach(() => jest.clearAllMocks());

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  // ─── POST /atendimentos-pais ─────────────────────────────────────────────
  describe('criar()', () => {
    it('deve criar um atendimento e retornar o objeto criado', async () => {
      const dto = {
        childId: 'child-001',
        responsavelNome: 'Responsável Sintético A',
        responsavelRelacao: 'Mãe',
        responsavelContato: 'contato-sintetico',
        tipo: TipoAtendimento.PRESENCIAL,
        dataAtendimento: '2026-02-18T10:00:00.000Z',
        assunto: 'Desenvolvimento motor da criança',
        descricao: 'Conversa sobre progresso no semestre',
        encaminhamento: 'Agendar avaliação com psicopedagoga',
        retornoNecessario: true,
        dataRetorno: '2026-03-01T00:00:00.000Z',
      };

      const mockResult = {
        id: 'atend-001',
        ...dto,
        status: StatusAtendimento.AGENDADO,
        atendidoPorId: mockUser.sub,
        mantenedoraId: mockUser.mantenedoraId,
        unitId: mockUser.unitId,
        child: { id: 'child-001', firstName: 'Ana', lastName: 'Lima' },
        criadoEm: new Date('2026-02-18T10:00:00.000Z'),
        atualizadoEm: new Date('2026-02-18T10:00:00.000Z'),
      };

      mockAtendimentoPaisService.criar.mockResolvedValue(mockResult);

      const result = await controller.criar(dto as any, mockUser);

      expect(service.criar).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toMatchObject({
        id: 'atend-001',
        childId: 'child-001',
        responsavelNome: 'Responsável Sintético A',
        tipo: TipoAtendimento.PRESENCIAL,
        status: StatusAtendimento.AGENDADO,
        child: { firstName: 'Ana', lastName: 'Lima' },
      });
    });

    it('deve propagar erro quando o service lança exceção', async () => {
      mockAtendimentoPaisService.criar.mockRejectedValue(
        new Error('Criança não encontrada ou sem acesso'),
      );

      await expect(
        controller.criar({ childId: 'invalid' } as any, mockUser),
      ).rejects.toThrow('Criança não encontrada ou sem acesso');
    });
  });

  // ─── GET /atendimentos-pais ──────────────────────────────────────────────
  describe('listar()', () => {
    it('deve repassar filtros server-side e retornar paginação', async () => {
      const query = {
        unitId: 'unit-001',
        classroomId: 'class-001',
        childId: 'child-001',
        status: StatusAtendimento.AGENDADO,
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-28T23:59:59.999Z',
        page: 2,
        limit: 10,
      } as any;
      const mockResult = {
        items: [{ id: 'atend-001', status: StatusAtendimento.AGENDADO }],
        pagination: { page: 2, limit: 10, total: 11, totalPages: 2, hasNext: false },
      };
      mockAtendimentoPaisService.listar.mockResolvedValue(mockResult);

      const result = await controller.listar(mockUser, query);

      expect(service.listar).toHaveBeenCalledWith(mockUser, query);
      expect(result).toEqual(mockResult);
    });

    it('deve usar query vazia quando nenhum filtro é enviado', async () => {
      mockAtendimentoPaisService.listar.mockResolvedValue({ items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false } });
      const query = {} as any;
      const result = await controller.listar(mockUser, query);
      expect(service.listar).toHaveBeenCalledWith(mockUser, query);
      expect(result.items).toEqual([]);
    });
  });

  // ─── PATCH /atendimentos-pais/:id/status ────────────────────────────────
  describe('atualizarStatus()', () => {
    it('deve atualizar o status de AGENDADO para REALIZADO', async () => {
      const mockUpdated = {
        id: 'atend-001',
        status: StatusAtendimento.REALIZADO,
        atualizadoEm: new Date(),
      };

      mockAtendimentoPaisService.atualizarStatus.mockResolvedValue(mockUpdated);

      const result = await controller.atualizarStatus(
        'atend-001',
        { status: StatusAtendimento.REALIZADO },
        mockUser,
      );

      expect(service.atualizarStatus).toHaveBeenCalledWith(
        'atend-001',
        StatusAtendimento.REALIZADO,
        mockUser,
      );
      expect(result).toMatchObject({ id: 'atend-001', status: StatusAtendimento.REALIZADO });
    });

    it('deve atualizar o status para CANCELADO', async () => {
      mockAtendimentoPaisService.atualizarStatus.mockResolvedValue({
        id: 'atend-001',
        status: StatusAtendimento.CANCELADO,
      });

      const result = await controller.atualizarStatus(
        'atend-001',
        { status: StatusAtendimento.CANCELADO },
        mockUser,
      );

      expect(result).toMatchObject({ status: StatusAtendimento.CANCELADO });
    });

    it('deve atualizar o status para PENDENTE_RETORNO', async () => {
      mockAtendimentoPaisService.atualizarStatus.mockResolvedValue({
        id: 'atend-001',
        status: StatusAtendimento.PENDENTE_RETORNO,
      });

      const result = await controller.atualizarStatus(
        'atend-001',
        { status: StatusAtendimento.PENDENTE_RETORNO },
        mockUser,
      );

      expect(result).toMatchObject({ status: StatusAtendimento.PENDENTE_RETORNO });
    });
  });
});
