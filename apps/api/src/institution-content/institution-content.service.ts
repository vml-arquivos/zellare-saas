import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { StorageService } from '../common/services/storage.service';
import { CreateContentUploadDto, ReviewContentUploadDto } from './dto/institution-content.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Extrai texto de um documento e pede pra IA estruturar como um plano de
 * aula/projeto pedagógico reutilizável. Segue exatamente o mesmo padrão de
 * inicialização lazy (não quebra o boot sem chave configurada) já usado em
 * IaAssistivaService — dois módulos, mesma convenção, sem duplicar o cliente.
 */
@Injectable()
export class InstitutionContentService {
  private readonly logger = new Logger(InstitutionContentService.name);
  private _cliente: OpenAI | null = null;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private storageService: StorageService,
  ) {}

  private getCliente(): OpenAI | null {
    if (this._cliente) return this._cliente;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (geminiKey) {
      this._cliente = new OpenAI({
        apiKey: geminiKey,
        baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
    } else if (openaiKey) {
      this._cliente = new OpenAI({ apiKey: openaiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
    }
    return this._cliente;
  }

  /**
   * Recebe o arquivo, salva no storage, cria o registro e dispara a
   * extração. A extração roda de forma best-effort: se não houver IA
   * configurada no ambiente, o upload fica em ENVIADO para revisão manual
   * — nunca bloqueia o usuário por causa disso.
   */
  async upload(
    file: Express.Multer.File,
    dto: CreateContentUploadDto,
    user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const stored = await this.storageService.save(file.buffer, file.originalname, user.mantenedoraId);

    const upload = await this.prisma.institutionContentUpload.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        type: dto.type,
        title: dto.title,
        fileUrl: stored.url,
        fileName: file.originalname,
        mimeType: file.mimetype,
        status: 'ENVIADO',
        uploadedBy: user.sub,
      },
    });

    await this.auditService.log({
      action: 'IMPORT',
      entity: 'INSTITUTION_CONTENT_UPLOAD' as any,
      entityId: upload.id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
      changes: { title: dto.title, type: dto.type, fileName: file.originalname },
    });

    // Extração assíncrona best-effort — não trava a resposta do upload
    this.tryExtract(upload.id, file.buffer, file.mimetype).catch((err) =>
      this.logger.warn(`Extração automática falhou para upload ${upload.id}: ${err.message}`),
    );

    return upload;
  }

  private async tryExtract(uploadId: string, buffer: Buffer, mimeType: string) {
    const cliente = this.getCliente();
    if (!cliente) {
      this.logger.log(`IA não configurada — upload ${uploadId} aguardando revisão manual.`);
      return;
    }

    await this.prisma.institutionContentUpload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSANDO' },
    });

    try {
      const text = await this.extractText(buffer, mimeType);
      if (!text || text.trim().length < 20) {
        throw new Error('Não foi possível extrair texto legível do arquivo');
      }

      const modelo = process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || 'gemini-2.5-flash';
      const response = await cliente.chat.completions.create({
        model: modelo,
        messages: [
          {
            role: 'system',
            content:
              'Você extrai a estrutura de planos de aula e projetos pedagógicos de educação infantil ' +
              'a partir de texto bruto. Responda APENAS em JSON válido, sem markdown, no formato: ' +
              '{ "titulo": string, "faixaEtaria": string, "objetivos": string[], "atividades": ' +
              '[{ "nome": string, "descricao": string, "materiais": string[] }], "duracaoEstimada": string, ' +
              '"observacoes": string }',
          },
          { role: 'user', content: text.slice(0, 12000) },
        ],
        response_format: { type: 'json_object' },
      });

      const extracted = JSON.parse(response.choices[0]?.message?.content ?? '{}');

      await this.prisma.institutionContentUpload.update({
        where: { id: uploadId },
        data: { status: 'PRONTO_PARA_REVISAO', extractedData: extracted },
      });
    } catch (err: any) {
      this.logger.warn(`Falha ao extrair conteúdo do upload ${uploadId}: ${err.message}`);
      await this.prisma.institutionContentUpload.update({
        where: { id: uploadId },
        data: { status: 'PRONTO_PARA_REVISAO', extractedData: undefined },
      });
    }
  }

  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      const pdfParse = await import('pdf-parse');
      const result = await (pdfParse as any).default(buffer);
      return result.text;
    }
    if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    // texto puro / markdown / csv como fallback
    return buffer.toString('utf-8');
  }

  async findAll(user: JwtPayload) {
    return this.prisma.institutionContentUpload.findMany({
      where: { mantenedoraId: user.mantenedoraId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const upload = await this.prisma.institutionContentUpload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('Upload não encontrado');
    if (upload.mantenedoraId !== user.mantenedoraId) {
      throw new ForbiddenException('Sem acesso a este upload');
    }
    return upload;
  }

  /**
   * Aprova o upload — a partir daqui, coordenação pedagógica confirma que
   * o conteúdo extraído (ou corrigido manualmente) está pronto para virar
   * um PlanningTemplate de fato disponível para os professores usarem.
   * A criação do PlanningTemplate em si fica no planning-template module
   * (este service só marca a aprovação e guarda os dados finais revisados).
   */
  async review(id: string, dto: ReviewContentUploadDto, approve: boolean, user: JwtPayload) {
    const upload = await this.findOne(id, user);

    const level = user.roles[0]?.level;
    if (level !== 'DEVELOPER' && level !== 'MANTENEDORA' && level !== 'STAFF_CENTRAL' && level !== 'UNIDADE') {
      throw new ForbiddenException('Sem permissão para revisar uploads de conteúdo institucional');
    }
    if (upload.status !== 'PRONTO_PARA_REVISAO') {
      throw new BadRequestException(`Upload está em status ${upload.status}, não pode ser revisado agora`);
    }

    const updated = await this.prisma.institutionContentUpload.update({
      where: { id },
      data: {
        status: approve ? 'APROVADO' : 'REJEITADO',
        reviewNotes: dto.reviewNotes,
        extractedData: dto.extractedDataOverride ?? upload.extractedData,
        reviewedAt: new Date(),
        reviewedBy: user.sub,
      },
    });

    await this.auditService.log({
      action: approve ? 'APPROVE_PLANNING' : 'UPDATE',
      entity: 'INSTITUTION_CONTENT_UPLOAD' as any,
      entityId: id,
      userId: user.sub,
      mantenedoraId: user.mantenedoraId,
      changes: { approved: approve },
    });

    return updated;
  }
}
