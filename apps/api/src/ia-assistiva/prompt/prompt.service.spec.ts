import { PromptService } from './prompt.service';

describe('PromptService — versionamento imutável', () => {
  const existing = {
    id: 'prompt-old',
    name: 'Plano infantil',
    description: 'Versão anterior',
    template: 'Gere um plano para {{turma}}',
    variables: ['turma'],
    version: 1,
    active: true,
    createdBy: 'user-1',
  };

  it('cria nova versão e desativa a anterior ao alterar conteúdo', async () => {
    const transactionClient = {
      promptTemplate: {
        update: jest.fn().mockResolvedValue({ ...existing, active: false }),
        create: jest.fn().mockResolvedValue({
          ...existing,
          id: 'prompt-new',
          template: 'Gere um plano contextual para {{turma}}',
          version: 2,
        }),
      },
    };
    const prisma = {
      promptTemplate: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient)),
    };
    const service = new PromptService(prisma as any);

    const result = await service.update('prompt-old', {
      template: 'Gere um plano contextual para {{turma}}',
    });

    expect(transactionClient.promptTemplate.update).toHaveBeenCalledWith({
      where: { id: 'prompt-old' },
      data: { active: false },
    });
    expect(transactionClient.promptTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Plano infantil',
        template: 'Gere um plano contextual para {{turma}}',
        version: 2,
        active: true,
      }),
    });
    expect(result.id).toBe('prompt-new');
    expect(prisma.promptTemplate.update).not.toHaveBeenCalled();
  });

  it('altera somente o status sem criar nova versão', async () => {
    const prisma = {
      promptTemplate: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({ ...existing, active: false }),
      },
      $transaction: jest.fn(),
    };
    const service = new PromptService(prisma as any);

    const result = await service.update('prompt-old', { active: false });

    expect(result.active).toBe(false);
    expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
      where: { id: 'prompt-old' },
      data: { active: false },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
