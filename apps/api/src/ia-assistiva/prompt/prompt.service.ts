import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreatePromptTemplateDto {
  name: string;
  description?: string;
  template: string;
  variables?: string[];
  createdBy?: string;
}

export interface UpdatePromptTemplateDto {
  name?: string;
  description?: string;
  template?: string;
  variables?: string[];
  active?: boolean;
}

@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria um novo template de prompt.
   * Cada criação gera a versão 1 de um novo template.
   */
  async create(dto: CreatePromptTemplateDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('O nome do template é obrigatório.');
    }
    if (!dto.template?.trim()) {
      throw new BadRequestException('O corpo do template é obrigatório.');
    }

    const template = await this.prisma.promptTemplate.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        template: dto.template.trim(),
        variables: dto.variables ?? [],
        version: 1,
        active: true,
        createdBy: dto.createdBy,
      },
    });

    this.logger.log(`PromptTemplate criado: ${template.id} — "${template.name}"`);
    return template;
  }

  /**
   * Atualiza um template existente, incrementando a versão automaticamente.
   * O template anterior é preservado no histórico (não é deletado).
   */
  async update(id: string, dto: UpdatePromptTemplateDto) {
    const existing = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`PromptTemplate "${id}" não encontrado.`);
    }
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('O nome do template não pode ficar vazio.');
    }
    if (dto.template !== undefined && !dto.template.trim()) {
      throw new BadRequestException('O corpo do template não pode ficar vazio.');
    }

    const contentChanged = [dto.name, dto.description, dto.template, dto.variables]
      .some((value) => value !== undefined);

    if (!contentChanged) {
      const statusUpdated = await this.prisma.promptTemplate.update({
        where: { id },
        data: dto.active === undefined ? {} : { active: dto.active },
      });
      this.logger.log(`PromptTemplate ${id} — status ativo=${statusUpdated.active}`);
      return statusUpdated;
    }

    const nextVersion = existing.version + 1;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.promptTemplate.update({
        where: { id },
        data: { active: false },
      });
      return tx.promptTemplate.create({
        data: {
          name: dto.name?.trim() ?? existing.name,
          description: dto.description === undefined ? existing.description : dto.description?.trim(),
          template: dto.template?.trim() ?? existing.template,
          variables: dto.variables ?? (existing.variables === null
            ? Prisma.JsonNull
            : existing.variables as Prisma.InputJsonValue),
          version: nextVersion,
          active: dto.active ?? true,
          createdBy: existing.createdBy,
        },
      });
    });

    this.logger.log(
      `PromptTemplate versionado: ${id} → ${updated.id} — versão ${updated.version}`,
    );
    return updated;
  }

  /**
   * Lista templates com filtros opcionais.
   */
  async findAll(filters?: { active?: boolean; name?: string }) {
    return this.prisma.promptTemplate.findMany({
      where: {
        ...(filters?.active !== undefined && { active: filters.active }),
        ...(filters?.name && {
          name: { contains: filters.name, mode: 'insensitive' },
        }),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Busca um template por ID.
   */
  async findOne(id: string) {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`PromptTemplate "${id}" não encontrado.`);
    }
    return template;
  }

  /**
   * Substitui as variáveis {{variavel}} no template pelos valores fornecidos.
   * Retorna o prompt final pronto para envio à IA.
   */
  interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] ?? `{{${key}}}`;
    });
  }

  /**
   * Desativa um template (soft delete — não remove do banco).
   */
  async deactivate(id: string) {
    const existing = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`PromptTemplate "${id}" não encontrado.`);
    }
    return this.prisma.promptTemplate.update({
      where: { id },
      data: { active: false },
    });
  }
}
