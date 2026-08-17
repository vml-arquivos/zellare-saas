import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatrixCacheInvalidationService } from '../cache/matrix-cache-invalidation.service';
import { AuditService } from '../common/services/audit.service';
import {
  CurriculumPdfParserService,
  ParsedMatrixEntry,
  MatrixSegment,
} from './curriculum-pdf-parser.service';
import { ImportCurriculumDto, ImportMatrixDto, ImportMode } from './dto/import-curriculum.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CampoDeExperiencia, RoleLevel, AuditLogAction, AuditLogEntity } from '@prisma/client';
import { getPedagogicalDay } from '../common/utils/date.utils';

/**
 * Resultado da importação
 */
export interface ImportResult {
  mode: ImportMode;
  matrixId?: string;
  totalExtracted: number;
  totalInserted: number;
  totalUpdated: number;
  totalUnchanged: number;
  preview?: any[];
  errors: string[];
}

export interface CsvPreviewRow {
  line: number;
  status: 'VALID' | 'ERROR';
  action?: 'INSERT' | 'UPDATE' | 'UNCHANGED';
  date?: string;
  campoDeExperiencia?: string;
  objetivoBNCC?: string;
  objetivoCurriculo?: string;
  errors: string[];
}

export interface CsvPreviewResult {
  matrixId?: string;
  delimiter: ',' | ';';
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
  preview: CsvPreviewRow[];
}

type ParsedCsvEntry = ParsedMatrixEntry & { line: number; dateKey: string };

@Injectable()
export class CurriculumImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly pdfParser: CurriculumPdfParserService,
    private readonly matrixCacheInvalidation: MatrixCacheInvalidationService,
  ) {}

  /**
   * Importação em modo dry-run (simulação)
   */
  async importDryRun(dto: ImportCurriculumDto, user: JwtPayload): Promise<ImportResult> {
    this.validatePermission(user);

    const segment = (dto.segment as MatrixSegment) || 'EI01';
    const parserResult = await this.pdfParser.parsePdf(dto.sourceUrl, segment);

    const result = await this.simulateUpsert(
      dto.mantenedoraId,
      dto.year,
      dto.segment,
      dto.version,
      parserResult.entries,
    );

    return {
      mode: ImportMode.DRY_RUN,
      totalExtracted: parserResult.totalExtracted,
      totalInserted: result.inserts,
      totalUpdated: result.updates,
      totalUnchanged: result.unchanged,
      preview: result.preview,
      errors: parserResult.errors,
    };
  }

  /**
   * Importação real (apply)
   */
  async importApply(matrixId: string, dto: ImportMatrixDto, user: JwtPayload): Promise<ImportResult> {
    this.validatePermission(user);

    const matrix = await this.prisma.curriculumMatrix.findUnique({
      where: { id: matrixId },
    });

    if (!matrix) {
      throw new NotFoundException('Matriz curricular não encontrada');
    }

    if (
      matrix.mantenedoraId !== user.mantenedoraId &&
      user.roles.every((r) => r.level !== RoleLevel.DEVELOPER)
    ) {
      throw new ForbiddenException('Você não tem permissão para importar esta matriz');
    }

    const segment = (matrix.segment as MatrixSegment) || 'EI01';
    const parserResult = await this.pdfParser.parsePdf(dto.sourceUrl, segment);

    const result = await this.applyUpsert(matrix, parserResult.entries, dto.force || false, user);

    await this.auditService.log({
      action: AuditLogAction.IMPORT,
      entity: AuditLogEntity.CURRICULUM_MATRIX,
      entityId: matrixId,
      userId: user.sub,
      mantenedoraId: matrix.mantenedoraId,
      unitId: undefined,
      changes: {
        totalExtracted: parserResult.totalExtracted,
        totalInserted: result.inserts,
        totalUpdated: result.updates,
        totalUnchanged: result.unchanged,
        sourceUrl: dto.sourceUrl,
        force: dto.force,
      },
    });

    await this.matrixCacheInvalidation.bump(matrix.mantenedoraId);

    return {
      mode: ImportMode.APPLY,
      matrixId,
      totalExtracted: parserResult.totalExtracted,
      totalInserted: result.inserts,
      totalUpdated: result.updates,
      totalUnchanged: result.unchanged,
      errors: parserResult.errors,
    };
  }

  // ─── Tarefa 3.3 — Importação via CSV ────────────────────────────────────────

  /**
   * Valida o CSV e calcula o impacto da importação sem criar matriz ou entry.
   * O endpoint é deliberadamente somente leitura para permitir aprovação humana.
   */
  async previewCsv(
    csvBuffer: Buffer,
    params: { mantenedoraId: string; name: string; year: number; segment: string; version: number },
    user: JwtPayload,
  ): Promise<CsvPreviewResult> {
    this.validatePermission(user);
    this.validateMantenedoraScope(params.mantenedoraId, user);
    this.validateCsvParams(params);

    const parsed = this.parseCsvEntries(csvBuffer, params.segment);
    const existingMatrix = await this.prisma.curriculumMatrix.findFirst({
      where: {
        mantenedoraId: params.mantenedoraId,
        year: params.year,
        segment: params.segment,
        version: params.version,
      },
    });

    const preview = parsed.rows.map((row) => ({ ...row }));
    if (existingMatrix) {
      for (const entry of parsed.entries.slice(0, 30)) {
        const row = preview.find((item) => item.line === entry.line);
        if (!row) continue;
        const existing = await this.findEntryByPedagogicalDay(existingMatrix.id, entry.date);
        row.action = existing
          ? (this.hasChanges(existing, entry) ? 'UPDATE' : 'UNCHANGED')
          : 'INSERT';
      }
    } else {
      for (const entry of parsed.entries.slice(0, 30)) {
        const row = preview.find((item) => item.line === entry.line);
        if (row) row.action = 'INSERT';
      }
    }

    return {
      matrixId: existingMatrix?.id,
      delimiter: parsed.delimiter,
      headers: parsed.headers,
      totalRows: parsed.totalRows,
      validRows: parsed.entries.length,
      invalidRows: parsed.rows.filter((row) => row.status === 'ERROR').length,
      errors: parsed.errors,
      preview: preview.slice(0, 30),
    };
  }

  /**
   * Importa uma matriz curricular a partir de CSV. O parser é compartilhado
   * com o preview para garantir que a aprovação humana veja exatamente o que
   * será aplicado. A criação da matriz ocorre somente depois da validação.
   */
  async importCsv(
    csvBuffer: Buffer,
    params: { mantenedoraId: string; name: string; year: number; segment: string; version: number },
    user: JwtPayload,
  ): Promise<{
    matrixId: string;
    importados: number;
    inseridos: number;
    atualizados: number;
    semAlteracao: number;
    totalLinhas: number;
    erros: string[];
  }> {
    this.validatePermission(user);
    this.validateMantenedoraScope(params.mantenedoraId, user);
    this.validateCsvParams(params);

    const parsed = this.parseCsvEntries(csvBuffer, params.segment);
    if (parsed.entries.length === 0) {
      throw new BadRequestException(
        parsed.errors.length > 0
          ? `Nenhuma linha válida para importar. ${parsed.errors.slice(0, 5).join(' | ')}`
          : 'CSV vazio ou sem linhas de dados',
      );
    }

    let matrix = await this.prisma.curriculumMatrix.findFirst({
      where: {
        mantenedoraId: params.mantenedoraId,
        year: params.year,
        segment: params.segment,
        version: params.version,
      },
    });

    if (!matrix) {
      matrix = await this.prisma.curriculumMatrix.create({
        data: {
          mantenedoraId: params.mantenedoraId,
          name: params.name.trim(),
          year: params.year,
          segment: params.segment,
          version: params.version,
          isActive: true,
          createdBy: user.sub,
        },
      });
    }

    const result = await this.applyUpsert(matrix, parsed.entries, false, user);
    await this.auditService.log({
      action: AuditLogAction.IMPORT,
      entity: AuditLogEntity.CURRICULUM_MATRIX,
      entityId: matrix.id,
      userId: user.sub,
      mantenedoraId: matrix.mantenedoraId,
      unitId: undefined,
      changes: {
        source: 'CSV',
        totalRows: parsed.totalRows,
        validRows: parsed.entries.length,
        invalidRows: parsed.errors.length,
        inserted: result.inserts,
        updated: result.updates,
        unchanged: result.unchanged,
        delimiter: parsed.delimiter,
      },
    });
    await this.matrixCacheInvalidation.bump(params.mantenedoraId);

    return {
      matrixId: matrix.id,
      importados: parsed.entries.length,
      inseridos: result.inserts,
      atualizados: result.updates,
      semAlteracao: result.unchanged,
      totalLinhas: parsed.totalRows,
      erros: parsed.errors,
    };
  }

  private validateCsvParams(params: { mantenedoraId: string; name: string; year: number; segment: string; version: number }) {
    if (!params.mantenedoraId?.trim()) throw new BadRequestException('mantenedoraId é obrigatório');
    if (!params.name?.trim()) throw new BadRequestException('Nome da matriz é obrigatório');
    if (!['EI01', 'EI02', 'EI03'].includes(params.segment)) throw new BadRequestException('Segmento inválido. Use EI01, EI02 ou EI03.');
    if (!Number.isInteger(params.year) || params.year < 2000 || params.year > 2100) throw new BadRequestException('Ano letivo inválido.');
    if (!Number.isInteger(params.version) || params.version < 1) throw new BadRequestException('Versão inválida.');
  }

  private validateMantenedoraScope(mantenedoraId: string, user: JwtPayload) {
    const isDeveloper = user.roles.some((role) => role.level === RoleLevel.DEVELOPER);
    if (!isDeveloper && (!user.mantenedoraId || user.mantenedoraId !== mantenedoraId)) {
      throw new ForbiddenException('Você não tem permissão para importar dados de outra mantenedora.');
    }
  }

  private parseCsvEntries(csvBuffer: Buffer, segment: string): {
    delimiter: ',' | ';';
    headers: string[];
    totalRows: number;
    entries: ParsedCsvEntry[];
    rows: CsvPreviewRow[];
    errors: string[];
  } {
    const { records, delimiter, malformed } = this.parseCsvRecords(csvBuffer.toString('utf-8'));
    if (records.length < 2) throw new BadRequestException('CSV vazio ou sem linhas de dados');

    const headers = records[0].cells.map((header) => this.normalizeCsvHeader(header));
    const required = ['data', 'campo_experiencia', 'objetivo_bncc', 'objetivo_curriculo'];
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length > 0) throw new BadRequestException(`Colunas obrigatórias ausentes no CSV: ${missing.join(', ')}`);

    const indexes = new Map(headers.map((header, index) => [header, index]));
    const errors = [...malformed];
    const rows: CsvPreviewRow[] = [];
    const entries: ParsedCsvEntry[] = [];
    const seenDates = new Set<string>();

    for (const record of records.slice(1)) {
      const rowErrors: string[] = [];
      const value = (names: string[]) => {
        const index = names.map((name) => indexes.get(name)).find((item) => item !== undefined);
        return index === undefined ? '' : (record.cells[index] ?? '').trim();
      };
      const dataStr = value(['data', 'date']);
      const campoRaw = value(['campo_experiencia', 'campo_de_experiencia']);
      const objetivoBNCC = value(['objetivo_bncc', 'objetivo_bncc_texto']);
      const objetivoCurriculo = value(['objetivo_curriculo', 'objetivo_do_curriculo']);
      const codigoBNCC = value(['codigo_bncc', 'codigo_bncc_code']) || undefined;
      const intencionalidade = value(['intencionalidade']) || undefined;
      const exemploAtividade = value(['exemplo_atividade', 'atividade']) || undefined;

      if (!dataStr) rowErrors.push('data é obrigatória');
      if (!campoRaw) rowErrors.push('campo_experiencia é obrigatório');
      if (!objetivoBNCC) rowErrors.push('objetivo_bncc é obrigatório');
      if (!objetivoCurriculo) rowErrors.push('objetivo_curriculo é obrigatório');

      let date: Date | undefined;
      let dateKey: string | undefined;
      if (dataStr) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataStr);
        if (!match) rowErrors.push(`data deve seguir YYYY-MM-DD (recebido: ${dataStr})`);
        else {
          const [, year, month, day] = match;
          const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
          if (check.getUTCFullYear() !== Number(year) || check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(day)) {
            rowErrors.push(`data inválida: ${dataStr}`);
          } else {
            dateKey = dataStr;
            date = new Date(`${dataStr}T12:00:00-03:00`);
            if (seenDates.has(dateKey)) rowErrors.push(`data duplicada no mesmo arquivo: ${dataStr}`);
            seenDates.add(dateKey);
          }
        }
      }

      const campo = campoRaw ? this.normalizeCsvCampo(campoRaw, codigoBNCC) : null;
      if (campoRaw && !campo) rowErrors.push(`campo_experiencia não reconhecido: ${campoRaw}`);
      if (codigoBNCC && codigoBNCC.length > 40) rowErrors.push('codigo_bncc excede 40 caracteres');
      if (objetivoBNCC.length > 5000 || objetivoCurriculo.length > 5000) rowErrors.push('objetivos excedem 5.000 caracteres');

      const previewRow: CsvPreviewRow = {
        line: record.line,
        status: rowErrors.length > 0 ? 'ERROR' : 'VALID',
        date: dataStr || undefined,
        campoDeExperiencia: campo || campoRaw || undefined,
        objetivoBNCC: objetivoBNCC || undefined,
        objetivoCurriculo: objetivoCurriculo || undefined,
        errors: rowErrors,
      };
      rows.push(previewRow);
      if (rowErrors.length > 0 || !date || !dateKey || !campo) {
        errors.push(`Linha ${record.line}: ${rowErrors.join('; ')}`);
        continue;
      }

      const dayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
      const yearStart = new Date(`${date.getUTCFullYear()}-01-01T12:00:00-03:00`);
      const weekOfYear = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + yearStart.getUTCDay() + 1) / 7);
      entries.push({
        line: record.line,
        dateKey,
        date,
        weekOfYear,
        dayOfWeek,
        bimester: Math.floor(date.getUTCMonth() / 2) + 1,
        campoDeExperiencia: campo,
        objetivoBNCC,
        objetivoBNCCCode: codigoBNCC,
        objetivoCurriculo,
        intencionalidade,
        exemploAtividade,
      });
    }

    return { delimiter, headers, totalRows: records.length - 1, entries, rows, errors };
  }

  private parseCsvRecords(text: string): { records: Array<{ line: number; cells: string[] }>; delimiter: ',' | ';'; malformed: string[] } {
    const source = text.replace(/^\uFEFF/, '');
    const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
    const delimiter: ',' | ';' = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
    const records: Array<{ line: number; cells: string[] }> = [];
    const malformed: string[] = [];
    let cells: string[] = [];
    let field = '';
    let inQuotes = false;
    let line = 1;
    let recordLine = 1;

    const pushRecord = () => {
      cells.push(field);
      field = '';
      if (cells.some((cell) => cell.trim() !== '')) records.push({ line: recordLine, cells });
      cells = [];
      recordLine = line + 1;
    };

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (inQuotes && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        cells.push(field);
        field = '';
      } else if (char === '\n' && !inQuotes) {
        pushRecord();
        line += 1;
      } else {
        field += char;
        if (char === '\n') line += 1;
      }
    }

    if (inQuotes) malformed.push(`Linha ${recordLine}: aspas não fechadas`);
    if (field.length > 0 || cells.length > 0) pushRecord();
    return { records, delimiter, malformed };
  }

  private normalizeCsvHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeCsvCampo(raw: string, bnccCode?: string): CampoDeExperiencia | null {
    const normalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const upper = raw.toUpperCase().replace(/[^A-Z_]/g, '');
    const enumValues = Object.values(CampoDeExperiencia) as string[];
    if (enumValues.includes(upper)) return upper as CampoDeExperiencia;
    if (normalized.includes('eu') && (normalized.includes('outro') || normalized.includes('nos'))) return CampoDeExperiencia.O_EU_O_OUTRO_E_O_NOS;
    if (normalized.includes('corpo') || normalized.includes('gestos') || normalized.includes('movimentos')) return CampoDeExperiencia.CORPO_GESTOS_E_MOVIMENTOS;
    if (normalized.includes('tracos') || normalized.includes('sons') || normalized.includes('cores') || normalized.includes('formas')) return CampoDeExperiencia.TRACOS_SONS_CORES_E_FORMAS;
    if (normalized.includes('escuta') || normalized.includes('fala') || normalized.includes('pensamento') || normalized.includes('imaginacao')) return CampoDeExperiencia.ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO;
    if (normalized.includes('espacos') || normalized.includes('espaco') || normalized.includes('tempos') || normalized.includes('quantidade') || normalized.includes('relacoes') || normalized.includes('transformacoes')) return CampoDeExperiencia.ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES;
    const code = bnccCode?.toUpperCase() ?? '';
    if (code.includes('EO')) return CampoDeExperiencia.O_EU_O_OUTRO_E_O_NOS;
    if (code.includes('CG')) return CampoDeExperiencia.CORPO_GESTOS_E_MOVIMENTOS;
    if (code.includes('TS')) return CampoDeExperiencia.TRACOS_SONS_CORES_E_FORMAS;
    if (code.includes('EF')) return CampoDeExperiencia.ESCUTA_FALA_PENSAMENTO_E_IMAGINACAO;
    if (code.includes('ET')) return CampoDeExperiencia.ESPACOS_TEMPOS_QUANTIDADES_RELACOES_E_TRANSFORMACOES;
    return null;
  }

  // ─── Métodos privados ────────────────────────────────────────────────────────

  /**
   * Simula upsert para dry-run
   */
  private async simulateUpsert(
    mantenedoraId: string,
    year: number,
    segment: string,
    version: number,
    entries: ParsedMatrixEntry[],
  ): Promise<{ inserts: number; updates: number; unchanged: number; preview: any[] }> {
    const existingMatrix = await this.prisma.curriculumMatrix.findFirst({
      where: { mantenedoraId, year, segment, version },
    });

    let inserts = 0;
    let updates = 0;
    let unchanged = 0;
    const preview: any[] = [];

    for (const entry of entries.slice(0, 5)) {
      const pedagogicalDay = getPedagogicalDay(entry.date);
      const existing = existingMatrix
        ? await this.findEntryByPedagogicalDay(existingMatrix.id, entry.date)
        : null;

      if (existing) {
        if (this.hasChanges(existing, entry)) {
          updates++;
          preview.push({ action: 'UPDATE', date: pedagogicalDay, entry });
        } else {
          unchanged++;
        }
      } else {
        inserts++;
        preview.push({ action: 'INSERT', date: pedagogicalDay, entry });
      }
    }

    for (const entry of entries.slice(5)) {
      const existing = existingMatrix
        ? await this.findEntryByPedagogicalDay(existingMatrix.id, entry.date)
        : null;

      if (existing) {
        if (this.hasChanges(existing, entry)) updates++;
        else unchanged++;
      } else {
        inserts++;
      }
    }

    return { inserts, updates, unchanged, preview };
  }

  /**
   * Aplica upsert real com match por range de dia pedagógico.
   */
  private async applyUpsert(
    matrix: any,
    entries: ParsedMatrixEntry[],
    force: boolean,
    user: JwtPayload,
  ): Promise<{ inserts: number; updates: number; unchanged: number }> {
    let inserts = 0;
    let updates = 0;
    let unchanged = 0;

    for (const entry of entries) {
      try {
        const existing = await this.findEntryByPedagogicalDay(matrix.id, entry.date);

        if (existing) {
          const hasLinkedEvents = await this.prisma.diaryEvent.count({
            where: { curriculumEntryId: existing.id },
          });

          if (hasLinkedEvents > 0 && !force) {
            const nonNormativeUpdate: any = {};
            if (
              entry.intencionalidade &&
              entry.intencionalidade.length > 5 &&
              this.normalize(existing.intencionalidade) !== this.normalize(entry.intencionalidade)
            ) {
              nonNormativeUpdate.intencionalidade = entry.intencionalidade;
            }
            if (
              entry.exemploAtividade &&
              entry.exemploAtividade.length > 5 &&
              this.normalize(existing.exemploAtividade) !== this.normalize(entry.exemploAtividade)
            ) {
              nonNormativeUpdate.exemploAtividade = entry.exemploAtividade;
            }

            if (Object.keys(nonNormativeUpdate).length > 0) {
              await this.prisma.curriculumMatrixEntry.update({
                where: { id: existing.id },
                data: nonNormativeUpdate,
              });
              updates++;
            } else {
              unchanged++;
            }
            continue;
          }

          if (!this.hasChanges(existing, entry) && !force) {
            unchanged++;
            continue;
          }

          if (force) {
            await this.prisma.curriculumMatrixEntry.update({
              where: { id: existing.id },
              data: {
                weekOfYear: entry.weekOfYear,
                dayOfWeek: entry.dayOfWeek,
                bimester: entry.bimester,
                campoDeExperiencia: entry.campoDeExperiencia,
                objetivoBNCC: entry.objetivoBNCC,
                objetivoBNCCCode: entry.objetivoBNCCCode,
                objetivoCurriculo: entry.objetivoCurriculo,
                ...(entry.intencionalidade ? { intencionalidade: entry.intencionalidade } : {}),
                ...(entry.exemploAtividade ? { exemploAtividade: entry.exemploAtividade } : {}),
              },
            });
            updates++;
          } else {
            const updateData: any = {};
            if (entry.intencionalidade) updateData.intencionalidade = entry.intencionalidade;
            if (entry.exemploAtividade) updateData.exemploAtividade = entry.exemploAtividade;

            const normativeChanged =
              this.normalize(existing.objetivoBNCC) !== this.normalize(entry.objetivoBNCC) ||
              this.normalize(existing.objetivoCurriculo) !== this.normalize(entry.objetivoCurriculo) ||
              existing.campoDeExperiencia !== entry.campoDeExperiencia;

            if (normativeChanged) {
              updateData.campoDeExperiencia = entry.campoDeExperiencia;
              updateData.objetivoBNCC = entry.objetivoBNCC;
              updateData.objetivoBNCCCode = entry.objetivoBNCCCode;
              updateData.objetivoCurriculo = entry.objetivoCurriculo;
              updateData.weekOfYear = entry.weekOfYear;
              updateData.dayOfWeek = entry.dayOfWeek;
              updateData.bimester = entry.bimester;
            }

            if (Object.keys(updateData).length > 0) {
              await this.prisma.curriculumMatrixEntry.update({
                where: { id: existing.id },
                data: updateData,
              });
              updates++;
            } else {
              unchanged++;
            }
          }
        } else {
          const ymd = getPedagogicalDay(entry.date);
          const canonicalDate = new Date(`${ymd}T12:00:00-03:00`);

          await this.prisma.curriculumMatrixEntry.create({
            data: {
              matrixId: matrix.id,
              date: canonicalDate,
              weekOfYear: entry.weekOfYear,
              dayOfWeek: entry.dayOfWeek,
              bimester: entry.bimester,
              campoDeExperiencia: entry.campoDeExperiencia,
              objetivoBNCC: entry.objetivoBNCC,
              objetivoBNCCCode: entry.objetivoBNCCCode,
              objetivoCurriculo: entry.objetivoCurriculo,
              intencionalidade: entry.intencionalidade,
              exemploAtividade: entry.exemploAtividade,
            },
          });
          inserts++;
        }
      } catch (error) {
        unchanged++;
      }
    }

    return { inserts, updates, unchanged };
  }

  /**
   * Busca uma entry pelo dia pedagógico (range 00:00 a 23:59 no fuso -03:00).
   */
  private async findEntryByPedagogicalDay(matrixId: string, date: Date) {
    const ymd = getPedagogicalDay(date);
    const start = new Date(`${ymd}T00:00:00-03:00`);
    const end = new Date(`${ymd}T23:59:59-03:00`);

    return this.prisma.curriculumMatrixEntry.findFirst({
      where: {
        matrixId,
        date: { gte: start, lte: end },
      },
    });
  }

  /**
   * Normaliza string para comparação
   */
  private normalize(str: string | null | undefined): string {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
  }

  /**
   * Verifica se há mudanças entre entrada existente e nova.
   */
  private hasChanges(existing: any, entry: ParsedMatrixEntry): boolean {
    const normativeChanged =
      this.normalize(existing.objetivoBNCC) !== this.normalize(entry.objetivoBNCC) ||
      this.normalize(existing.objetivoCurriculo) !== this.normalize(entry.objetivoCurriculo) ||
      existing.campoDeExperiencia !== entry.campoDeExperiencia;

    const nonNormativeChanged =
      (entry.intencionalidade &&
        this.normalize(existing.intencionalidade) !== this.normalize(entry.intencionalidade)) ||
      (entry.exemploAtividade &&
        this.normalize(existing.exemploAtividade) !== this.normalize(entry.exemploAtividade));

    return normativeChanged || !!nonNormativeChanged;
  }

  /**
   * Valida permissão de importação
   */
  private validatePermission(user: JwtPayload): void {
    const hasPermission = user.roles.some(
      (role) =>
        role.level === RoleLevel.DEVELOPER ||
        role.level === RoleLevel.MANTENEDORA ||
        role.level === RoleLevel.STAFF_CENTRAL,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Apenas Mantenedora e Staff Central podem importar matrizes curriculares',
      );
    }
  }
}
