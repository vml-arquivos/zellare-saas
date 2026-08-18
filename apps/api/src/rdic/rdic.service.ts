import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DiaryEventStatus, RdicDocumentEventType, StatusRDIX } from '@prisma/client';
import { MICROGESTO_CATALOGO } from '../common/constants/microgestos.constants';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Fluxo de aprovação do RDIC (P0):
 *
 *  PROFESSOR          → cria/edita em RASCUNHO ou DEVOLVIDO
 *                     → envia para revisão (→ EM_REVISAO)
 *
 *  COORD. UNIDADE     → lê, edita (RASCUNHO ou EM_REVISAO), salva
 *  (UNIDADE)          → aprova (→ APROVADO)
 *                     → devolve com comentário obrigatório (→ DEVOLVIDO)
 *
 *  STAFF_CENTRAL      → somente leitura (apenas APROVADO/PUBLICADO)
 *                     → 403 para editar/aprovar/devolver
 *
 *  MANTENEDORA/DEV    → leitura completa (sem ações de aprovação)
 */
const SEEDF_RDIC_PROFILE = {
  code: 'SEEDF_RDIC_1_CICLO',
  name: 'RDIC — Relatório do Desenvolvimento Individual da Criança',
  documentLabel: 'Relatório do Desenvolvimento Individual da Criança - RDIC',
  institutionType: 'PUBLICA',
  authorityName: 'Secretaria de Estado de Educação do Distrito Federal',
  authorityReference: 'SEEDF / SUBEB / Diretoria de Educação Infantil',
  curriculumReference: 'Currículo em Movimento do Distrito Federal — Educação Infantil (2018)',
  sourceUrl: 'https://www.educacao.df.gov.br/documents/d/seedf/construcao-do-relatorio-do-desenvolvimento-individual-da-crianca_rdic-1-pdf',
  version: 1,
  status: 'ATIVO',
  isCurated: true,
  periodicity: 'SEMESTRAL',
  requiredFields: [
    'identificacao_institucional', 'dados_crianca', 'periodo_letivo',
    'desenvolvimento_integral', 'direitos_aprendizagem', 'campos_experiencia',
    'providencias_encaminhamentos', 'assinaturas_professores',
    'assinatura_coordenacao', 'ciencia_secretaria', 'ciencia_familia',
  ],
  signaturePolicy: {
    required: ['PROFESSOR', 'COORDENACAO', 'SECRETARIA_ESCOLAR'],
    optional: ['FAMILIA_RESPONSAVEL'],
    jointTeacherSignature: true,
  },
  familyPolicy: { acknowledgmentRequired: true, visibleAfter: 'PUBLICADO', channel: 'PORTAL_FAMILIA' },
  archivePolicy: { required: true, destination: 'DOSSIER_CHILD', retentionYears: null },
  templateSchema: {
    sections: [
      { key: 'identificacao', label: 'Identificação', input: 'structured' },
      { key: 'desenvolvimento_integral', label: 'Desenvolvimento integral', input: 'structured_and_short_text' },
      { key: 'direitos_aprendizagem', label: 'Direitos de aprendizagem', input: 'markers' },
      { key: 'campos_experiencia', label: 'Campos de experiências', input: 'markers' },
      { key: 'evidencias', label: 'Evidências do cotidiano', input: 'evidence_links' },
      { key: 'providencias_encaminhamentos', label: 'Providências e encaminhamentos', input: 'short_text' },
      { key: 'assinaturas', label: 'Assinaturas e ciência', input: 'signatures' },
    ],
  },
} as const;

const GENERIC_CHILD_DEVELOPMENT_PROFILE = {
  code: 'ZELARE_RELATORIO_DESCRITIVO_INFANTIL',
  name: 'Relatório Descritivo de Desenvolvimento Infantil',
  documentLabel: 'Relatório Descritivo de Desenvolvimento Infantil',
  institutionType: 'OUTRA',
  authorityName: null,
  authorityReference: null,
  curriculumReference: 'Referência curricular configurável da instituição',
  sourceUrl: null,
  version: 1,
  status: 'ATIVO',
  isCurated: true,
  periodicity: 'CONFIGURAVEL',
  requiredFields: ['identificacao_institucional', 'dados_crianca', 'periodo_letivo', 'desenvolvimento_integral'],
  signaturePolicy: { required: ['AUTOR_RESPONSAVEL', 'REVISOR_INSTITUCIONAL'], optional: ['FAMILIA_RESPONSAVEL'] },
  familyPolicy: { acknowledgmentRequired: false, visibleAfter: 'PUBLICADO', channel: 'PORTAL_FAMILIA' },
  archivePolicy: { required: false, destination: 'INSTITUTION_STORAGE', retentionYears: null },
  templateSchema: {
    sections: [
      { key: 'identificacao', label: 'Identificação', input: 'structured' },
      { key: 'desenvolvimento_integral', label: 'Desenvolvimento integral', input: 'structured_and_short_text' },
      { key: 'evidencias', label: 'Evidências do cotidiano', input: 'evidence_links' },
      { key: 'proximos_passos', label: 'Próximos passos', input: 'short_text' },
      { key: 'assinaturas', label: 'Assinaturas e ciência', input: 'signatures' },
    ],
  },
} as const;

@Injectable()
export class RdicService {
  constructor(private readonly prisma: PrismaService) {}

  private roleTypes(user: JwtPayload): string[] {
    return (user.roles ?? []).map((role) => String(role.type ?? ''));
  }

  private canManageProfiles(user: JwtPayload): boolean {
    return user.roles?.some((role) => role.level === 'DEVELOPER' || role.type === 'MANTENEDORA_ADMIN') ?? false;
  }

  private assertCanManageProfiles(user: JwtPayload) {
    if (!this.canManageProfiles(user)) {
      throw new ForbiddenException('Somente Developer ou Mantenedora Administrador pode configurar perfis documentais.');
    }
  }

  private jsonInput(value: unknown) {
    return JSON.parse(JSON.stringify(value ?? {})) as any;
  }

  private signatureManifest(current: unknown, key: string, value: Record<string, unknown>) {
    const base = current && typeof current === 'object' ? current as Record<string, unknown> : {};
    return this.jsonInput({ ...base, [key]: value });
  }

  private profileSnapshot(profile: any) {
    return {
      id: profile.id,
      code: profile.code,
      name: profile.name,
      documentLabel: profile.documentLabel,
      institutionType: profile.institutionType,
      authorityName: profile.authorityName,
      authorityReference: profile.authorityReference,
      curriculumReference: profile.curriculumReference,
      sourceUrl: profile.sourceUrl,
      version: profile.version,
      periodicity: profile.periodicity,
      requiredFields: profile.requiredFields,
      signaturePolicy: profile.signaturePolicy,
      familyPolicy: profile.familyPolicy,
      archivePolicy: profile.archivePolicy,
      templateSchema: profile.templateSchema,
    };
  }

  private async ensureGlobalProfile(seed: typeof SEEDF_RDIC_PROFILE | typeof GENERIC_CHILD_DEVELOPMENT_PROFILE, actorId: string) {
    const existing = await this.prisma.rdicDocumentProfile.findFirst({
      where: { mantenedoraId: null, code: seed.code, version: seed.version, status: 'ATIVO' },
    });
    if (existing) return existing;
    return this.prisma.rdicDocumentProfile.create({
      data: { ...seed, mantenedoraId: null, createdById: actorId },
    });
  }

  private async resolveProfile(dto: any, user: JwtPayload) {
    if (dto?.profileId) {
      const selected = await this.prisma.rdicDocumentProfile.findFirst({
        where: {
          id: String(dto.profileId),
          status: 'ATIVO',
          OR: [{ mantenedoraId: user.mantenedoraId }, { mantenedoraId: null, isCurated: true }],
        },
      });
      if (!selected) throw new NotFoundException('Perfil documental não encontrado ou fora do escopo.');
      return selected;
    }

    if (user.unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: { id: user.unitId, mantenedoraId: user.mantenedoraId },
        select: { rdicProfile: true },
      });
      if (unit?.rdicProfile?.status === 'ATIVO') return unit.rdicProfile;
    }

    const tenant = await this.prisma.mantenedora.findFirst({
      where: { id: user.mantenedoraId },
      select: { defaultRdicProfile: true },
    });
    if (tenant?.defaultRdicProfile?.status === 'ATIVO') return tenant.defaultRdicProfile;

    const global = await this.ensureGlobalProfile(GENERIC_CHILD_DEVELOPMENT_PROFILE, user.sub);
    return global;
  }

  private async registerEvent(
    instancia: { id: string; mantenedoraId: string; unitId: string },
    actorId: string,
    eventType: RdicDocumentEventType,
    fromStatus?: StatusRDIX | null,
    toStatus?: StatusRDIX | null,
    comment?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.rdicDocumentEvent.create({
      data: {
        mantenedoraId: instancia.mantenedoraId,
        unitId: instancia.unitId,
        instanciaId: instancia.id,
        actorId,
        eventType,
        fromStatus: fromStatus ?? undefined,
        toStatus: toStatus ?? undefined,
        comment: comment ?? undefined,
        metadata: metadata ? this.jsonInput(metadata) : undefined,
      },
    });
  }

  private documentHash(content: unknown, profileSnapshot: unknown) {
    return createHash('sha256')
      .update(JSON.stringify({ content, profileSnapshot }))
      .digest('hex');
  }

  private async transitionWithEvent(
    instancia: any,
    actorId: string,
    eventType: RdicDocumentEventType,
    data: Record<string, unknown>,
    toStatus?: StatusRDIX,
    comment?: string,
    include?: Record<string, unknown>,
  ) {
    const operation = async (tx: any) => {
      const updated = await tx.rDIXInstancia.update({
        where: { id: instancia.id },
        data,
        ...(include ? { include } : {}),
      });
      await tx.rdicDocumentEvent.create({
        data: {
          mantenedoraId: instancia.mantenedoraId,
          unitId: instancia.unitId,
          instanciaId: instancia.id,
          actorId,
          eventType,
          fromStatus: instancia.status,
          toStatus: toStatus ?? instancia.status,
          comment: comment ?? undefined,
        },
      });
      return updated;
    };
    const transaction = (this.prisma as any).$transaction;
    return typeof transaction === 'function' ? transaction.call(this.prisma, operation) : operation(this.prisma);
  }

  async listarPerfis(user: JwtPayload) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');
    await this.ensureGlobalProfile(SEEDF_RDIC_PROFILE, user.sub);
    await this.ensureGlobalProfile(GENERIC_CHILD_DEVELOPMENT_PROFILE, user.sub);
    return this.prisma.rdicDocumentProfile.findMany({
      where: {
        status: 'ATIVO',
        OR: [{ mantenedoraId: user.mantenedoraId }, { mantenedoraId: null, isCurated: true }],
      },
      orderBy: [{ isCurated: 'desc' }, { name: 'asc' }, { version: 'desc' }],
    });
  }

  async criarPerfil(dto: any, user: JwtPayload) {
    this.assertCanManageProfiles(user);
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');
    if (!dto?.code || !dto?.name || !dto?.documentLabel || !dto?.institutionType || !dto?.periodicity) {
      throw new BadRequestException('code, name, documentLabel, institutionType e periodicity são obrigatórios');
    }
    if (dto.isCurated) throw new ForbiddenException('Perfis curados pertencem à plataforma e não podem ser criados pelo tenant.');
    return this.prisma.rdicDocumentProfile.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        code: String(dto.code).trim().toUpperCase(),
        name: String(dto.name).trim(),
        documentLabel: String(dto.documentLabel).trim(),
        institutionType: dto.institutionType,
        authorityName: dto.authorityName ?? undefined,
        authorityReference: dto.authorityReference ?? undefined,
        curriculumReference: dto.curriculumReference ?? undefined,
        sourceUrl: dto.sourceUrl ?? undefined,
        version: Number(dto.version ?? 1),
        status: 'ATIVO',
        isCurated: false,
        periodicity: String(dto.periodicity).trim().toUpperCase(),
        requiredFields: dto.requiredFields ?? [],
        signaturePolicy: dto.signaturePolicy ?? {},
        familyPolicy: dto.familyPolicy ?? {},
        archivePolicy: dto.archivePolicy ?? {},
        templateSchema: dto.templateSchema ?? {},
        createdById: user.sub,
      },
    });
  }

  async clonarPerfil(profileId: string, user: JwtPayload) {
    this.assertCanManageProfiles(user);
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');
    const base = await this.prisma.rdicDocumentProfile.findFirst({
      where: { id: profileId, status: 'ATIVO', OR: [{ mantenedoraId: null, isCurated: true }, { mantenedoraId: user.mantenedoraId }] },
    });
    if (!base) throw new NotFoundException('Perfil documental não encontrado ou fora do escopo.');
    const code = `${base.code}_CUSTOM_${Date.now()}`.slice(0, 100);
    return this.prisma.rdicDocumentProfile.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        code,
        name: `${base.name} — personalizado`,
        documentLabel: base.documentLabel,
        institutionType: base.institutionType,
        authorityName: base.authorityName,
        authorityReference: base.authorityReference,
        curriculumReference: base.curriculumReference,
        sourceUrl: base.sourceUrl,
        version: 1,
        status: 'ATIVO',
        isCurated: false,
        periodicity: base.periodicity,
        requiredFields: this.jsonInput(base.requiredFields),
        signaturePolicy: this.jsonInput(base.signaturePolicy),
        familyPolicy: this.jsonInput(base.familyPolicy),
        archivePolicy: this.jsonInput(base.archivePolicy),
        templateSchema: this.jsonInput(base.templateSchema),
        createdById: user.sub,
      },
    });
  }

  async definirPerfilPadrao(dto: { profileId: string; unitId?: string | null }, user: JwtPayload) {
    this.assertCanManageProfiles(user);
    if (!user?.mantenedoraId || !dto?.profileId) throw new BadRequestException('profileId é obrigatório');
    const profile = await this.prisma.rdicDocumentProfile.findFirst({
      where: { id: dto.profileId, status: 'ATIVO', OR: [{ mantenedoraId: user.mantenedoraId }, { mantenedoraId: null, isCurated: true }] },
    });
    if (!profile) throw new NotFoundException('Perfil documental não encontrado ou fora do escopo.');
    if (dto.unitId) {
      const unit = await this.prisma.unit.findFirst({ where: { id: dto.unitId, mantenedoraId: user.mantenedoraId }, select: { id: true } });
      if (!unit) throw new NotFoundException('Unidade não encontrada ou fora do escopo.');
      await this.prisma.unit.update({ where: { id: dto.unitId }, data: { rdicProfileId: profile.id } });
      return { scope: 'UNIT', unitId: dto.unitId, profileId: profile.id, profileVersion: profile.version };
    }
    await this.prisma.mantenedora.update({ where: { id: user.mantenedoraId }, data: { defaultRdicProfileId: profile.id } });
    return { scope: 'MANTENEDORA', profileId: profile.id, profileVersion: profile.version };
  }

  // ─── Criar RDIC (professor) ───────────────────────────────────────────────
  async criar(dto: any, user: JwtPayload) {
    if (!user?.mantenedoraId || !user?.unitId) {
      throw new ForbiddenException('Escopo inválido');
    }
    const { childId, classroomId, periodo, anoLetivo, rascunhoJson } = dto;
    if (!childId || !classroomId || !periodo || !anoLetivo) {
      throw new BadRequestException('childId, classroomId, periodo e anoLetivo são obrigatórios');
    }

    // Verificar se a turma pertence à unidade do professor e se a criança está matriculada nela.
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, unitId: user.unitId },
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada ou fora do escopo');
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { childId, classroomId, status: 'ATIVA' },
      select: { childId: true },
    });
    if (!enrollment) throw new NotFoundException('Criança não matriculada na turma informada');

    const profile = await this.resolveProfile(dto, user);
    // Templates são derivados do perfil e não sobrescrevem templates históricos.
    let template = await this.prisma.rDIXTemplate.findFirst({
      where: { mantenedoraId: user.mantenedoraId, profileId: profile.id, ativo: true },
      orderBy: { atualizadoEm: 'desc' },
    });
    if (!template) {
      template = await this.prisma.rDIXTemplate.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          profileId: profile.id,
          profileVersion: profile.version,
          segmento: 'EDUCACAO_INFANTIL',
          titulo: profile.documentLabel,
          estruturaJson: this.jsonInput(profile.templateSchema),
          criadoPorId: user.sub,
        },
      });
    }

    // Verificar se já existe instância para este período
    const existente = await this.prisma.rDIXInstancia.findFirst({
      where: { childId, classroomId, periodo, anoLetivo },
    });
    if (existente) {
      throw new BadRequestException(
        `Já existe um RDIC para esta criança no período ${periodo}/${anoLetivo}. Use o endpoint de atualização.`,
      );
    }

    const periodoEnumMap: Record<string, string> = {
      'PRIMEIRO_TRIMESTRE': 'PRIMEIRO_TRIMESTRE',
      'SEGUNDO_TRIMESTRE':  'SEGUNDO_TRIMESTRE',
      'TERCEIRO_TRIMESTRE': 'TERCEIRO_TRIMESTRE',
      'PRIMEIRO_BIMESTRE':  'PRIMEIRO_BIMESTRE',
      'SEGUNDO_BIMESTRE':   'SEGUNDO_BIMESTRE',
      'TERCEIRO_BIMESTRE':  'TERCEIRO_BIMESTRE',
      'QUARTO_BIMESTRE':    'QUARTO_BIMESTRE',
    };
    const periodoEnumResolvido = dto.periodoEnum
      ? (periodoEnumMap[dto.periodoEnum] ?? null)
      : null;

    const profileSnapshot = this.profileSnapshot(profile);
    const rascunho = rascunhoJson ?? {};
    const created = await this.prisma.rDIXInstancia.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId:        user.unitId,
        templateId:    template.id,
        profileId:     profile.id,
        profileVersion: profile.version,
        profileSnapshot,
        childId,
        classroomId,
        periodo,
        periodoEnum:   periodoEnumResolvido as any ?? undefined,
        anoLetivo:     Number(anoLetivo),
        status:        'RASCUNHO',
        rascunhoJson:  rascunho,
        documentHash:  this.documentHash(rascunho, profileSnapshot),
        criadoPorId:   user.sub,
      },
      include: {
        child: { select: { firstName: true, lastName: true } },
        profile: true,
      },
    });
    await this.registerEvent(created, user.sub, 'CRIADO', null, 'RASCUNHO', undefined, {
      profileCode: profile.code,
      profileVersion: profile.version,
    });
    return created;
  }

  // ─── Atualizar rascunho ───────────────────────────────────────────────────
  async atualizar(id: string, dto: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;

    // STAFF_CENTRAL: nunca pode editar
    if (level === 'STAFF_CENTRAL') {
      throw new ForbiddenException('Central pedagógica não pode editar RDICs.');
    }

    const instancia = await this._buscarEValidar(id, user);

    // Professor só pode editar RASCUNHO ou DEVOLVIDO (e apenas o próprio)
    if (level === 'PROFESSOR') {
      if (!['RASCUNHO', 'DEVOLVIDO'].includes(instancia.status)) {
        throw new ForbiddenException(
          'Você só pode editar o RDIC enquanto estiver em RASCUNHO ou DEVOLVIDO.',
        );
      }
      if (instancia.criadoPorId !== user.sub) {
        throw new ForbiddenException('Você só pode editar seus próprios RDICs.');
      }
    }

    // Coordenadora pedagógica pode editar RASCUNHO ou EM_REVISAO
    if (level === 'UNIDADE') {
      if (!['RASCUNHO', 'EM_REVISAO', 'DEVOLVIDO'].includes(instancia.status)) {
        throw new ForbiddenException('RDIC já aprovado ou publicado. Não é possível editar.');
      }
    }

    const rascunhoJson = dto.rascunhoJson ?? instancia.rascunhoJson ?? {};
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.ATUALIZADO,
      { rascunhoJson, documentHash: this.documentHash(rascunhoJson, instancia.profileSnapshot) },
      instancia.status as StatusRDIX,
      undefined,
      { child: { select: { firstName: true, lastName: true } } },
    );
  }

  // ─── Enviar para revisão (professor → EM_REVISAO) ─────────────────────────
  async enviarParaRevisao(id: string, user: JwtPayload) {
    const instancia = await this._buscarEValidar(id, user);
    if (!['RASCUNHO', 'DEVOLVIDO'].includes(instancia.status)) {
      throw new BadRequestException('Apenas RDICs em RASCUNHO ou DEVOLVIDO podem ser enviados para revisão.');
    }
    if (instancia.criadoPorId !== user.sub) {
      throw new ForbiddenException('Apenas o professor que criou o RDIC pode enviá-lo para revisão.');
    }
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.ENVIADO_REVISAO,
      {
        status: StatusRDIX.EM_REVISAO,
        submittedAt: new Date(),
        signatureManifest: this.signatureManifest(instancia.signatureManifest, 'teacher', {
          submittedAt: new Date().toISOString(),
          actorId: user.sub,
          mode: 'HUMAN_REVIEW_REQUIRED',
        }),
      },
      StatusRDIX.EM_REVISAO,
    );
  }

  // ─── Aprovar (coord. unidade → APROVADO) ─────────────────────────────────
  async aprovar(id: string, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica da unidade pode aprovar o RDIC.');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (!['EM_REVISAO', 'RASCUNHO'].includes(instancia.status)) {
      throw new BadRequestException('Apenas RDICs em EM_REVISAO ou RASCUNHO podem ser aprovados.');
    }
    const conteudoFinal = instancia.conteudoFinal ?? instancia.rascunhoJson ?? {};
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.APROVADO,
      {
        status: StatusRDIX.APROVADO,
        conteudoFinal,
        documentHash: this.documentHash(conteudoFinal, instancia.profileSnapshot),
        revisadoPorId: user.sub,
        reviewedAt: new Date(),
        signatureManifest: this.signatureManifest(instancia.signatureManifest, 'coordination', {
          approvedAt: new Date().toISOString(),
          actorId: user.sub,
          mode: 'HUMAN_REVIEW',
        }),
      },
      StatusRDIX.APROVADO,
      undefined,
      { child: { select: { firstName: true, lastName: true } } },
    );
  }

  // ─── Devolver ao professor (coord. unidade → DEVOLVIDO) ───────────────────
  async devolver(id: string, dto: { comment: string }, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica pode devolver o RDIC.');
    }
    if (!dto.comment || dto.comment.trim().length < 5) {
      throw new BadRequestException('O comentário de devolução é obrigatório (mínimo 5 caracteres).');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (instancia.status !== 'EM_REVISAO') {
      throw new BadRequestException('Apenas RDICs em EM_REVISAO podem ser devolvidos.');
    }
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.DEVOLVIDO,
      { status: StatusRDIX.DEVOLVIDO, reviewComment: dto.comment, revisadoPorId: user.sub, reviewedAt: new Date() },
      StatusRDIX.DEVOLVIDO,
      dto.comment,
    );
  }

  // ─── Finalizar/Aprovar legado (coord. pedagógica unidade → FINALIZADO) ────
  // Mantido para compatibilidade; novos clientes devem usar /aprovar
  async finalizar(id: string, dto: any, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica da unidade pode finalizar o RDIC.');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (!['EM_REVISAO', 'RASCUNHO'].includes(instancia.status)) {
      throw new BadRequestException('RDIC já finalizado ou publicado.');
    }
    const conteudoFinal = dto.conteudoFinal ?? instancia.rascunhoJson ?? {};
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.FINALIZADO,
      {
        status: StatusRDIX.FINALIZADO,
        conteudoFinal,
        documentHash: this.documentHash(conteudoFinal, instancia.profileSnapshot),
        revisadoPorId: user.sub,
        finalizadoEm: new Date(),
        reviewedAt: new Date(),
        signatureManifest: this.signatureManifest(instancia.signatureManifest, 'institutional_finalization', {
          finalizedAt: new Date().toISOString(),
          actorId: user.sub,
          roleTypes: this.roleTypes(user),
          mode: 'HUMAN_REVIEW',
        }),
      },
      StatusRDIX.FINALIZADO,
      undefined,
      { child: { select: { firstName: true, lastName: true } } },
    );
  }

  // ─── Publicar (coord. pedagógica unidade → PUBLICADO) ────────────────────
  async publicar(id: string, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica da unidade pode publicar o RDIC.');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (!['FINALIZADO', 'APROVADO'].includes(instancia.status)) {
      throw new BadRequestException('Apenas RDICs FINALIZADOS ou APROVADOS podem ser publicados.');
    }
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.PUBLICADO,
      {
        status: StatusRDIX.PUBLICADO,
        publicadoEm: new Date(),
        signatureManifest: this.signatureManifest(instancia.signatureManifest, 'publication', {
          publishedAt: new Date().toISOString(),
          actorId: user.sub,
          mode: 'INSTITUTIONAL_RELEASE',
        }),
      },
      StatusRDIX.PUBLICADO,
    );
  }

  // ─── Status de completude da turma por bimestre ───────────────────────────
  // GET /rdic/turma/status?classroomId&periodo&anoLetivo
  async turmaStatus(query: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const { classroomId, periodo, anoLetivo } = query;
    if (!classroomId || !periodo || !anoLetivo) {
      throw new BadRequestException('classroomId, periodo e anoLetivo são obrigatórios');
    }

    // Verificar escopo
    const classroom = await this.prisma.classroom.findFirst({
      where: {
        id: classroomId,
        unit: { mantenedoraId: user.mantenedoraId },
        ...(level === 'PROFESSOR' || level === 'UNIDADE' ? { unitId: user.unitId! } : {}),
      },
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada ou fora do escopo');

    // Buscar crianças com matrícula ativa na turma
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId, status: 'ATIVA' },
      include: { child: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Buscar RDICs existentes para essa turma/período/ano
    const rdics = await this.prisma.rDIXInstancia.findMany({
      where: {
        classroomId,
        periodo,
        anoLetivo: Number(anoLetivo),
        mantenedoraId: user.mantenedoraId,
      },
      select: {
        id: true,
        childId: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    const rdicByChild = new Map(rdics.map(r => [r.childId, r]));
    const totalCriancas = enrollments.length;
    const criancas = enrollments.map(({ child }) => ({
      childId: child.id,
      nome: `${child.firstName} ${child.lastName}`,
      rdic: rdicByChild.get(child.id) ?? null,
      status: rdicByChild.get(child.id)?.status ?? 'PENDENTE',
    }));

    const contagem = {
      total: totalCriancas,
      pendente: criancas.filter(c => c.status === 'PENDENTE').length,
      rascunho: criancas.filter(c => c.status === 'RASCUNHO').length,
      emRevisao: criancas.filter(c => c.status === 'EM_REVISAO').length,
      devolvido: criancas.filter(c => c.status === 'DEVOLVIDO').length,
      aprovado: criancas.filter(c => c.status === 'APROVADO').length,
      finalizado: criancas.filter(c => ['FINALIZADO', 'PUBLICADO'].includes(c.status)).length,
    };

    return {
      classroomId,
      classroomName: classroom.name,
      periodo,
      anoLetivo: Number(anoLetivo),
      completude: totalCriancas > 0
        ? Math.round(((contagem.aprovado + contagem.finalizado) / totalCriancas) * 100)
        : 0,
      contagem,
      criancas,
    };
  }

  // ─── Resumo express da turma por marcações reais ───────────────────────────
  async turmaResumoExpress(query: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL', 'UNIDADE', 'PROFESSOR']
        .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const classroomId = query?.classroomId;
    if (!classroomId) throw new BadRequestException('classroomId é obrigatório');

    const classroom = await this.prisma.classroom.findFirst({
      where: {
        id: classroomId,
        unit: { mantenedoraId: user.mantenedoraId },
        ...(level === 'PROFESSOR' || level === 'UNIDADE' ? { unitId: user.unitId! } : {}),
      },
      select: { id: true, name: true, unitId: true },
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada ou fora do escopo');
    if (level === 'PROFESSOR') {
      const vínculo = await this.prisma.classroomTeacher.findFirst({
        where: { teacherId: user.sub, classroomId, isActive: true },
        select: { classroomId: true },
      });
      if (!vínculo) throw new ForbiddenException('Você não está vinculado a esta turma.');
    }

    const endDate = query?.endDate ? new Date(query.endDate) : new Date();
    const startDate = query?.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('Período inválido para o resumo da turma');
    }
    if (endDate.getTime() - startDate.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('O período máximo do resumo é de 366 dias');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId, status: 'ATIVA' },
      select: { child: { select: { id: true, firstName: true, lastName: true } } },
    });
    const children = enrollments.map(({ child }) => ({
      childId: child.id,
      nome: `${child.firstName} ${child.lastName}`.trim(),
    }));
    const childIds = children.map((child) => child.childId);
    if (childIds.length === 0) {
      return {
        classroom: { id: classroom.id, name: classroom.name },
        periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        totalCriancas: 0,
        cobertura: { comRegistros: 0, semRegistros: 0, percentual: 0 },
        totalDiarios: 0,
        totalObservacoes: 0,
        totalMicrogestos: 0,
        totalPontosAtencao: 0,
        criancas: [],
      };
    }

    const [events, observations] = await Promise.all([
      this.prisma.diaryEvent.findMany({
        where: {
          classroomId,
          childId: { in: childIds },
          mantenedoraId: user.mantenedoraId,
          eventDate: { gte: startDate, lte: endDate },
          status: { in: [DiaryEventStatus.PUBLICADO, DiaryEventStatus.REVISADO, DiaryEventStatus.ARQUIVADO] },
        },
        select: { childId: true, eventDate: true, aiContext: true },
      }),
      this.prisma.developmentObservation.findMany({
        where: { classroomId, childId: { in: childIds }, date: { gte: startDate, lte: endDate } },
        select: { childId: true, developmentAlerts: true },
      }),
    ]);

    type Row = {
      childId: string;
      nome: string;
      diarios: number;
      observacoes: number;
      microgestos: number;
      dias: Set<string>;
      porNivel: Record<string, number>;
      atencao: number;
    };
    const rows = new Map<string, Row>(children.map((child) => [child.childId, {
      ...child,
      diarios: 0,
      observacoes: 0,
      microgestos: 0,
      dias: new Set<string>(),
      porNivel: {},
      atencao: 0,
    }]));

    for (const event of events) {
      const row = rows.get(event.childId);
      if (!row) continue;
      row.diarios += 1;
      row.dias.add(new Date(event.eventDate).toISOString().slice(0, 10));
      const context = event.aiContext && typeof event.aiContext === 'object' ? event.aiContext as Record<string, unknown> : {};
      const microgestos = Array.isArray(context.microgestos) ? context.microgestos : [];
      for (const raw of microgestos) {
        if (!raw || typeof raw !== 'object') continue;
        const nivel = String((raw as Record<string, unknown>).nivel ?? '').trim();
        if (!nivel) continue;
        row.microgestos += 1;
        row.porNivel[nivel] = (row.porNivel[nivel] ?? 0) + 1;
        if (nivel === 'REQUER_ATENCAO') row.atencao += 1;
      }
    }
    for (const observation of observations) {
      const row = rows.get(observation.childId);
      if (!row) continue;
      row.observacoes += 1;
      if (observation.developmentAlerts) row.atencao += 1;
    }

    const criancas = Array.from(rows.values()).map((row) => {
      const totalRegistros = row.diarios + row.observacoes;
      const tendencia = totalRegistros === 0
        ? 'SEM_DADOS'
        : row.atencao > 0
          ? 'ATENCAO'
          : (row.porNivel.ALCANCADO ?? 0) + (row.porNivel.CONSOLIDADO ?? 0) >= Math.max(1, row.microgestos / 2)
            ? 'FAVORAVEL'
            : 'EM_DESENVOLVIMENTO';
      return {
        childId: row.childId,
        nome: row.nome,
        diarios: row.diarios,
        observacoes: row.observacoes,
        microgestos: row.microgestos,
        diasComRegistro: row.dias.size,
        porNivel: row.porNivel,
        pontosAtencao: row.atencao,
        tendencia,
      };
    }).sort((a, b) => b.microgestos - a.microgestos || a.nome.localeCompare(b.nome));

    const comRegistros = criancas.filter((child) => child.diarios + child.observacoes > 0).length;
    return {
      classroom: { id: classroom.id, name: classroom.name },
      periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      totalCriancas: criancas.length,
      cobertura: {
        comRegistros,
        semRegistros: criancas.length - comRegistros,
        percentual: Math.round((comRegistros / criancas.length) * 100),
      },
      totalDiarios: events.length,
      totalObservacoes: observations.length,
      totalMicrogestos: criancas.reduce((sum, child) => sum + child.microgestos, 0),
      totalPontosAtencao: criancas.reduce((sum, child) => sum + child.pontosAtencao, 0),
      criancas,
    };
  }

  // ─── Consolidado da turma (dados para relatório) ──────────────────────────
  // GET /rdic/turma/consolidado?classroomId&periodo&anoLetivo
  async turmaConsolidado(query: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const { classroomId, periodo, anoLetivo } = query;
    if (!classroomId || !periodo || !anoLetivo) {
      throw new BadRequestException('classroomId, periodo e anoLetivo são obrigatórios');
    }

    // STAFF_CENTRAL só vê APROVADO/PUBLICADO
    const statusFilter: any =
      level === 'STAFF_CENTRAL'
        ? { status: { in: ['APROVADO', 'PUBLICADO', 'FINALIZADO'] as any } }
        : {};

    const rdics = await this.prisma.rDIXInstancia.findMany({
      where: {
        classroomId,
        periodo,
        anoLetivo: Number(anoLetivo),
        mantenedoraId: user.mantenedoraId,
        ...statusFilter,
      },
      include: {
        child: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });

    return {
      classroomId,
      periodo,
      anoLetivo: Number(anoLetivo),
      total: rdics.length,
      rdics: rdics.map(r => ({
        id: r.id,
        childId: r.childId,
        childNome: `${r.child.firstName} ${r.child.lastName}`,
        status: r.status,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt,
        reviewComment: r.reviewComment,
        conteudo: r.conteudoFinal ?? r.rascunhoJson,
      })),
    };
  }

  // ─── Listar RDICs com controle de acesso por role ─────────────────────────
  async listar(query: any, user: JwtPayload) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    const where: any = { mantenedoraId: user.mantenedoraId };

    // PROFESSOR: vê apenas os RDICs que ele criou (qualquer status)
    if (level === 'PROFESSOR') {
      where.criadoPorId = user.sub;
      where.unitId = user.unitId;
    }
    // UNIDADE (coord. pedagógica): vê todos da sua unidade
    else if (level === 'UNIDADE') {
      where.unitId = user.unitId;
      // Exige pelo menos um filtro granular para evitar carga de toda a unidade
      if (!query.classroomId && !query.childId) {
        throw new BadRequestException(
          'Para a coordenação de unidade, é obrigatório filtrar por classroomId ou childId.',
        );
      }
    }
    // STAFF_CENTRAL: somente APROVADO/PUBLICADO/FINALIZADO
    else if (level === 'STAFF_CENTRAL') {
      where.status = { in: ['APROVADO', 'PUBLICADO', 'FINALIZADO'] as any };
    }
    // MANTENEDORA / DEVELOPER: vê tudo (sem filtro adicional)

    // Filtros opcionais da query
    if (query.classroomId) where.classroomId = query.classroomId;
    if (query.childId) where.childId = query.childId;
    if (query.status) where.status = query.status;
    if (query.periodo) where.periodo = query.periodo;
    if (query.anoLetivo) where.anoLetivo = Number(query.anoLetivo);
    if (query.unitId && (level === 'MANTENEDORA' || level === 'DEVELOPER' || level === 'STAFF_CENTRAL')) {
      where.unitId = query.unitId;
    }

    return this.prisma.rDIXInstancia.findMany({
      where,
      include: {
        child: { select: { firstName: true, lastName: true, dateOfBirth: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
  }

  // ─── Detalhe de um RDIC ───────────────────────────────────────────────────
  async getById(id: string, user: JwtPayload) {
    const instancia = await this._buscarEValidar(id, user);
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    // STAFF_CENTRAL só pode ler APROVADO/PUBLICADO/FINALIZADO
    if (level === 'STAFF_CENTRAL' && !['APROVADO', 'PUBLICADO', 'FINALIZADO'].includes(instancia.status)) {
      throw new ForbiddenException(
        'Este RDIC ainda não foi aprovado pela coordenação pedagógica da unidade.',
      );
    }

    return instancia;
  }

  async registrarCienciaFamilia(id: string, user: JwtPayload) {
    if (!user.roles?.some((role) => role.level === 'FAMILIA')) {
      throw new ForbiddenException('Somente o responsável familiar pode registrar ciência neste fluxo.');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (instancia.status !== StatusRDIX.PUBLICADO) {
      throw new BadRequestException('A ciência familiar só fica disponível após a publicação do documento.');
    }
    const guardian = await this.prisma.childGuardian.findFirst({
      where: { childId: instancia.childId, userId: user.sub, revokedAt: null, canViewDevelopment: true },
      select: { id: true },
    });
    if (!guardian) throw new ForbiddenException('Responsável sem vínculo ou consentimento de desenvolvimento ativo.');
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.CIENCIA_FAMILIA,
      {
        familyAcknowledgedAt: new Date(),
        familyAcknowledgedById: user.sub,
        signatureManifest: this.jsonInput({
          ...(instancia.signatureManifest && typeof instancia.signatureManifest === 'object' ? instancia.signatureManifest : {}),
          family: { acknowledgedAt: new Date().toISOString(), acknowledgedById: user.sub, mode: 'PORTAL_FAMILIA' },
        }),
      },
      StatusRDIX.PUBLICADO,
    );
  }

  async arquivar(id: string, user: JwtPayload) {
    const allowed = user.roles?.some((role) => ['UNIDADE', 'MANTENEDORA', 'DEVELOPER'].includes(role.level));
    if (!allowed) throw new ForbiddenException('Somente secretaria/unidade, mantenedora ou Developer pode arquivar o RDIC.');
    const instancia = await this._buscarEValidar(id, user);
    const level = user.roles?.[0]?.level;
    if (level === 'UNIDADE' && user.unitId !== instancia.unitId) {
      throw new ForbiddenException('Documento fora da unidade autorizada.');
    }
    if (instancia.status !== StatusRDIX.PUBLICADO) {
      throw new BadRequestException('Somente documentos publicados podem ser arquivados.');
    }
    const policy = instancia.profileSnapshot && typeof instancia.profileSnapshot === 'object'
      ? (instancia.profileSnapshot as Record<string, unknown>).archivePolicy
      : null;
    const archivePolicy = policy && typeof policy === 'object' ? policy as Record<string, unknown> : {};
    if (archivePolicy.required === true && !instancia.familyAcknowledgedAt) {
      throw new BadRequestException('Este perfil exige ciência da família antes do arquivamento.');
    }
    return this.transitionWithEvent(
      instancia,
      user.sub,
      RdicDocumentEventType.ARQUIVADO,
      { status: StatusRDIX.ARQUIVADO, archivedAt: new Date(), archivedById: user.sub },
      StatusRDIX.ARQUIVADO,
    );
  }

  async eventos(id: string, user: JwtPayload) {
    const instancia = await this._buscarEValidar(id, user);
    const level = user.roles?.[0]?.level;
    if (level === 'STAFF_CENTRAL' && !([StatusRDIX.APROVADO, StatusRDIX.FINALIZADO, StatusRDIX.PUBLICADO, StatusRDIX.ARQUIVADO] as StatusRDIX[]).includes(instancia.status)) {
      throw new ForbiddenException('A trilha só fica disponível à equipe central após aprovação.');
    }
    if (level === 'UNIDADE' && user.unitId !== instancia.unitId) {
      throw new ForbiddenException('Documento fora da unidade autorizada.');
    }
    return this.prisma.rdicDocumentEvent.findMany({
      where: { instanciaId: instancia.id, mantenedoraId: user.mantenedoraId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Central da Criança ─────────────────────────────────────────────────
  /**
   * Diagnóstico operacional rápido para o professor/coordenação.
   * Usa somente eventos publicados/revisados do diário e observações reais,
   * sem inferência clínica e sem criar uma segunda fonte de dados.
   */
  async resumoExpress(childId: string, query: any, user: JwtPayload) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const child = await this.prisma.child.findFirst({
      where: { id: childId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: { status: 'ATIVA' },
          select: { classroom: { select: { id: true, name: true, unitId: true } } },
          take: 1,
        },
      },
    });
    if (!child) throw new NotFoundException('Criança não encontrada ou fora do escopo');

    const level = user.roles?.[0]?.level;
    const classroom = child.enrollments?.[0]?.classroom;
    if (level === 'UNIDADE' && user.unitId && classroom && classroom.unitId !== user.unitId) {
      throw new ForbiddenException('Criança fora da unidade autorizada');
    }
    if (level === 'PROFESSOR') {
      if (!classroom) throw new ForbiddenException('Criança sem turma ativa');
      const vínculo = await this.prisma.classroomTeacher.findFirst({
        where: { teacherId: user.sub, classroomId: classroom.id, isActive: true },
        select: { classroomId: true },
      });
      if (!vínculo) throw new ForbiddenException('Você não está vinculado à turma desta criança.');
    }

    const endDate = query?.endDate ? new Date(query.endDate) : new Date();
    const startDate = query?.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('Período inválido para o diagnóstico express');
    }
    const maxEnd = new Date(startDate.getTime() + 366 * 24 * 60 * 60 * 1000);
    if (endDate > maxEnd) throw new BadRequestException('O período máximo do diagnóstico é de 366 dias');

    const [diaryEvents, observations] = await Promise.all([
      this.prisma.diaryEvent.findMany({
        where: {
          childId,
          mantenedoraId: user.mantenedoraId,
          eventDate: { gte: startDate, lte: endDate },
          status: { in: [DiaryEventStatus.PUBLICADO, DiaryEventStatus.REVISADO, DiaryEventStatus.ARQUIVADO] },
        },
        select: { eventDate: true, aiContext: true },
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.developmentObservation.findMany({
        where: { childId, date: { gte: startDate, lte: endDate } },
        select: { date: true, category: true, developmentAlerts: true, recommendations: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const porNivel: Record<string, number> = {};
    const porCategoria: Record<string, number> = {};
    const habilidades = new Map<string, { microgestoId: string; label: string; categoria: string; nivel: string; ocorrencias: number }>();
    const dias = new Set<string>();
    let totalMicrogestos = 0;

    for (const event of diaryEvents) {
      dias.add(new Date(event.eventDate).toISOString().slice(0, 10));
      const context = event.aiContext && typeof event.aiContext === 'object' ? event.aiContext as Record<string, unknown> : {};
      const microgestos = Array.isArray(context.microgestos) ? context.microgestos : [];
      for (const raw of microgestos) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const microgestoId = String(item.microgestoId ?? item.id ?? '').trim();
        const nivel = String(item.nivel ?? '').trim();
        if (!microgestoId || !nivel) continue;
        const catalog = MICROGESTO_CATALOGO.find((entry) => entry.id === microgestoId);
        const categoria = String(item.categoria ?? catalog?.categoria ?? 'OUTRO');
        const label = String(item.label ?? catalog?.label ?? microgestoId);
        const key = `${microgestoId}:${nivel}`;
        const current = habilidades.get(key);
        habilidades.set(key, {
          microgestoId,
          label,
          categoria,
          nivel,
          ocorrencias: (current?.ocorrencias ?? 0) + 1,
        });
        porNivel[nivel] = (porNivel[nivel] ?? 0) + 1;
        porCategoria[categoria] = (porCategoria[categoria] ?? 0) + 1;
        totalMicrogestos += 1;
      }
    }

    const observacoesComAlerta = observations.filter((item) => Boolean(item.developmentAlerts)).length;
    const totalAtencao = porNivel.REQUER_ATENCAO ?? 0;
    const tendencia = totalMicrogestos === 0 && observations.length === 0
      ? 'SEM_DADOS'
      : totalAtencao > 0 || observacoesComAlerta > 0
        ? 'ATENCAO'
        : (porNivel.ALCANCADO ?? 0) + (porNivel.CONSOLIDADO ?? 0) >= Math.max(1, totalMicrogestos / 2)
          ? 'FAVORAVEL'
          : 'EM_DESENVOLVIMENTO';

    const pontosAtencao = Array.from(habilidades.values())
      .filter((item) => item.nivel === 'REQUER_ATENCAO')
      .sort((a, b) => b.ocorrencias - a.ocorrencias)
      .slice(0, 5)
      .map((item) => `${item.label} (${item.ocorrencias} registro${item.ocorrencias === 1 ? '' : 's'})`);
    if (observacoesComAlerta > 0) pontosAtencao.push(`${observacoesComAlerta} observação(ões) com alerta de desenvolvimento`);

    const proximosPassos = pontosAtencao.length > 0
      ? pontosAtencao.slice(0, 3).map((item) => `Acompanhar ${item.toLowerCase()} nas próximas vivências e registrar a resposta da criança.`)
      : totalMicrogestos > 0
        ? ['Continuar a coleta estruturada nas vivências do cotidiano e comparar a evolução no próximo período.']
        : ['Registrar pelo menos uma observação estruturada para iniciar a série de evolução.'];

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName },
      classroom: classroom ?? null,
      periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      fontes: {
        diariosPublicados: diaryEvents.length,
        observacoesDesenvolvimento: observations.length,
        diasComRegistro: dias.size,
        microgestos: totalMicrogestos,
      },
      porNivel,
      porCategoria,
      habilidades: Array.from(habilidades.values()).sort((a, b) => b.ocorrencias - a.ocorrencias),
      tendencia,
      pontosAtencao,
      proximosPassos,
    };
  }

  async centralDaCrianca(childId: string, user: JwtPayload) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');
    const level = user.roles?.[0]?.level;

    // 1. Dados da criança com restrições alimentares
    const child = await this.prisma.child.findFirst({
      where: { id: childId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        photoUrl: true,
        allergies: true,
        medicalConditions: true,
        medicationNeeds: true,
        enrollments: {
          where: { status: 'ATIVA' },
          select: {
            classroom: { select: { id: true, name: true } },

          },
          take: 1,
        },
        dietaryRestrictions: {
          where: { isActive: true },
          select: {
            id: true,
            type: true,
            name: true,
            severity: true,
            forbiddenFoods: true,
          },
        },
      },
    });

    if (!child) {
      throw new NotFoundException('Criança não encontrada ou fora do escopo');
    }

    // 2. PROFESSOR: verificar vínculo com a turma da criança
    if (level === 'PROFESSOR') {
      const enrollment = child.enrollments?.[0];
      if (!enrollment) {
        throw new ForbiddenException('Criança sem turma activa');
      }
      const ct = await this.prisma.classroomTeacher.findFirst({
        where: {
          teacherId: user.sub,
          classroomId: enrollment.classroom.id,
          isActive: true,
        },
      });
      if (!ct) {
        throw new ForbiddenException(
          'Você não está vinculado à turma desta criança.',
        );
      }
    }

    // 3. Acompanhamento nutricional — query separada e defensiva
    let acompanhamentoNutricional: any = null;
    try {
      acompanhamentoNutricional = await (this.prisma as any)
        .acompanhamentoNutricional.findUnique({
          where: { childId },
          select: {
            statusCaso: true,
            orientacoesProfCozinha: true,
            restricoesOperacionais: true,
            substituicoesSeguras: true,
            proximaReavaliacao: true,
          },
        });
    } catch {
      // Silencioso — acompanhamento é opcional, nunca deve quebrar o endpoint
    }

    // 4. Todos os RDICs da criança (mais recente primeiro)
    const rdics = await this.prisma.rDIXInstancia.findMany({
      where: { childId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        periodo: true,
        periodoEnum: true,
        anoLetivo: true,
        status: true,
        rascunhoJson: true,
        reviewComment: true,
        submittedAt: true,
        reviewedAt: true,
        finalizadoEm: true,
        publicadoEm: true,
        criadoEm: true,
        atualizadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
    });

    // 5. Contar eventos do diário nos últimos 90 dias
    let totalDiario90dias = 0;
    try {
      const noventa = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      totalDiario90dias = await this.prisma.diaryEvent.count({
        where: {
          childId,
          mantenedoraId: user.mantenedoraId,
          createdAt: { gte: noventa },
        },
      });
    } catch {
      // Silencioso — contagem é informativa, não deve quebrar o endpoint
    }

    return {
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth
          ? (child.dateOfBirth as Date).toISOString()
          : null,
        gender: child.gender ? String(child.gender) : null,
        photoUrl: child.photoUrl ?? null,
        allergies: child.allergies ?? null,
        medicalConditions: child.medicalConditions ?? null,
        medicationNeeds: child.medicationNeeds ?? null,
        turma: child.enrollments?.[0]?.classroom ?? null,
        restricoesAlimentares: child.dietaryRestrictions ?? [],
        acompanhamentoNutricional,
      },
      rdics,
      rdicAtual: rdics[0] ?? null,
      totalDiario90dias,
    };
  }

  // ─── Helper interno ───────────────────────────────────────────────────────
  private async _buscarEValidar(id: string, user: JwtPayload) {
    const instancia = await this.prisma.rDIXInstancia.findUnique({
      where: { id },
      include: {
        child: { select: { firstName: true, lastName: true } },
        profile: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!instancia) throw new NotFoundException('RDIC não encontrado');
    if (instancia.mantenedoraId !== user.mantenedoraId) {
      throw new ForbiddenException('Fora do escopo');
    }
    return instancia;
  }
}
