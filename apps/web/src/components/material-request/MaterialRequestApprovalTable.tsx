import { useState, useEffect, useCallback } from 'react';
import {
  listUnitMaterialRequests,
  getMaterialRequestById,
  reviewMaterialRequest,
  getCategoryLabel,
  getStatusLabel,
  getStatusColor,
  type MaterialRequest,
  type MaterialCategory,
  type RequestStatus,
  type ReviewItemDecision,
} from '../../api/material-request';
import { getAccessibleClassrooms } from '../../api/lookup';
import type { AccessibleClassroom } from '../../types/lookup';
import { X, CheckCircle2, XCircle, ChevronRight, Loader2, CheckSquare, Square, Printer } from 'lucide-react';
import { getErrorMessage } from '../../utils/errorMessage';

// ─── Badges ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
}

function UrgenciaBadge({ urgencia }: { urgencia?: string }) {
  if (!urgencia) return null;
  const colors: Record<string, string> = {
    BAIXA: 'bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]',
    MEDIA: 'bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)]',
    ALTA: 'bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error-border)]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[urgencia] ?? 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'}`}>
      {urgencia.charAt(0) + urgencia.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ParsedItem {
  id?: string;
  item: string;
  quantidade: number;
  unidade?: string;
  observacao?: string;
}

function parseItensDetalhado(req: MaterialRequest): ParsedItem[] {
  // Prioridade 1: itens do banco (MaterialRequestItem)
  if (req.items && req.items.length > 0) {
    return req.items.map(i => ({
      id: i.id,
      item: i.productName ?? i.materialName ?? i.materialId ?? '—',
      quantidade: i.quantity,
      unidade: i.unit,
      observacao: i.observations,
    }));
  }
  // Prioridade 2: itens originais do campo description (retornados pelo getById)
  if (req.originalItens && req.originalItens.length > 0) {
    return req.originalItens.map(i => ({
      item: i.item,
      quantidade: i.quantidade,
      unidade: i.unidade,
    }));
  }
  // Prioridade 3: parsear description diretamente
  if (req.description) {
    try {
      const parsed = JSON.parse(req.description) as {
        itens?: { item: string; quantidade: number; unidade?: string; observacao?: string }[];
        _review?: boolean;
      };
      if (!parsed._review && parsed.itens && parsed.itens.length > 0) {
        return parsed.itens.map(i => ({
          item: i.item,
          quantidade: i.quantidade,
          unidade: i.unidade,
          observacao: i.observacao,
        }));
      }
    } catch { /* ignora */ }
  }
  return [{ item: req.title, quantidade: req.quantity ?? 1 }];
}

function parseItensResumo(req: MaterialRequest): string {
  const itens = parseItensDetalhado(req);
  if (itens.length === 0) return req.title;
  if (itens.length === 1) return `${itens[0].item} x${itens[0].quantidade}`;
  return `${itens.length} itens`;
}

function parseUrgencia(req: MaterialRequest): string | undefined {
  if (req.urgencia) return req.urgencia;
  if (req.description) {
    try {
      const parsed = JSON.parse(req.description) as { urgencia?: string; _review?: boolean };
      if (!parsed._review && parsed.urgencia) return parsed.urgencia;
    } catch { /* ignora */ }
  }
  return undefined;
}

// ─── Estado de revisão por item ───────────────────────────────────────────────

interface ItemReviewState {
  itemId: string;
  approved: boolean;
  qtyApproved: number;
  reason: string;
  qtyMax: number;
}

// ─── Tipos de aba ─────────────────────────────────────────────────────────────

type Tab = 'pendentes' | 'aprovadas' | 'todas';

const TAB_STATUS: Record<Tab, RequestStatus | undefined> = {
  pendentes: 'SOLICITADO',
  aprovadas: 'APROVADO',
  todas: undefined,
};

// ─── Drawer de Detalhe com aprovação por item ─────────────────────────────────

interface DetalheDrawerProps {
  reqId: string | null;
  onClose: () => void;
  onRevisaoSalva: () => void;
  onRejeitar: (id: string, titulo: string) => void;
  processando: string | null;
  setProcessando: (id: string | null) => void;
  setToast: (t: { msg: string; tipo: 'ok' | 'erro' } | null) => void;
}

function DetalheDrawer({
  reqId,
  onClose,
  onRevisaoSalva,
  onRejeitar,
  processando,
  setProcessando,
  setToast,
}: DetalheDrawerProps) {
  const [req, setReq] = useState<MaterialRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estado de revisão por item
  const [itemStates, setItemStates] = useState<ItemReviewState[]>([]);
  const [notaGeral, setNotaGeral] = useState('');
  const [modoRevisao, setModoRevisao] = useState(false);

  useEffect(() => {
    if (!reqId) { setReq(null); setItemStates([]); setModoRevisao(false); return; }
    setLoading(true); setErro(null); setModoRevisao(false);
    getMaterialRequestById(reqId)
      .then(data => {
        setReq(data);
        // Inicializa estados de revisão por item (apenas para itens do banco com ID)
        const itens = parseItensDetalhado(data);
        const states: ItemReviewState[] = itens
          .filter(i => i.id)
          .map(i => ({
            itemId: i.id!,
            approved: true,
            qtyApproved: i.quantidade,
            reason: '',
            qtyMax: i.quantidade,
          }));
        setItemStates(states);
      })
      .catch(() => setErro('Não foi possível carregar os detalhes.'))
      .finally(() => setLoading(false));
  }, [reqId]);

  if (!reqId) return null;

  // FIX C2.3: imprimir/PDF da requisição aprovada
  function imprimirRequisicao(r: MaterialRequest) {
    const itens = parseItensDetalhado(r);
    const professor = r.createdByUser
      ? `${r.createdByUser.firstName} ${r.createdByUser.lastName}`
      : '—';
    const urgencia = parseUrgencia(r);
    const statusLabel = r.statusVirtual === 'PARCIAL' ? 'Aprovado Parcialmente'
      : r.status === 'REJEITADO' ? 'Rejeitado'
      : 'Aprovado';
    const itensHtml = itens.map(i => {
      const dbItem = i.id ? r.items?.find(it => it.id === i.id) : null;
      const aprovado = dbItem?.approved !== undefined ? (dbItem.approved ? 'Sim' : 'Não') : '—';
      const qtdAprov = dbItem?.qtyApproved != null ? String(dbItem.qtyApproved) : '—';
      return `<tr><td style="padding:6px 10px;border-bottom:1px solid var(--border-default)">${i.item}</td><td style="padding:6px 10px;border-bottom:1px solid var(--border-default);text-align:center">${i.quantidade}</td><td style="padding:6px 10px;border-bottom:1px solid var(--border-default);text-align:center">${i.unidade ?? '—'}</td><td style="padding:6px 10px;border-bottom:1px solid var(--border-default);text-align:center">${aprovado}</td><td style="padding:6px 10px;border-bottom:1px solid var(--border-default);text-align:center">${qtdAprov}</td><td style="padding:6px 10px;border-bottom:1px solid var(--border-default);font-size:11px;color:var(--text-tertiary)">${dbItem?.approvalReason ?? i.observacao ?? '—'}</td></tr>`;
    }).join('');
    const notaRevisao = r.reviewData?.notes ? `<p style="margin:4px 0 0"><strong>Nota:</strong> ${r.reviewData.notes}</p>` : '';
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Requisição ${r.code}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111;font-size:13px}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;font-weight:400;color:var(--text-tertiary);margin:0 0 20px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:var(--surface-subtle);padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text-tertiary)}td{font-size:12px}.badge{display:inline-block;padding:2px 8px;border-radius:9999px;background:var(--success-bg);color:#065f46;font-size:11px;font-weight:600}.badge-red{display:inline-block;padding:2px 8px;border-radius:9999px;background:var(--error-bg);color:var(--error);font-size:11px;font-weight:600}.badge-yellow{display:inline-block;padding:2px 8px;border-radius:9999px;background:var(--warning-bg);color:#92400e;font-size:11px;font-weight:600}@media print{.no-print{display:none}}</style></head><body><h1>Requisição de Materiais — ${r.code}</h1><h2>${r.title}</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"><div><p style="margin:0;color:var(--text-tertiary);font-size:11px;text-transform:uppercase">Professor</p><p style="margin:2px 0 0;font-weight:600">${professor}</p></div><div><p style="margin:0;color:var(--text-tertiary);font-size:11px;text-transform:uppercase">Turma</p><p style="margin:2px 0 0;font-weight:600">${r.classroom?.name ?? '—'}</p></div><div><p style="margin:0;color:var(--text-tertiary);font-size:11px;text-transform:uppercase">Categoria</p><p style="margin:2px 0 0">${r.type}</p></div><div><p style="margin:0;color:var(--text-tertiary);font-size:11px;text-transform:uppercase">Data</p><p style="margin:2px 0 0">${new Date(r.requestedDate ?? r.createdAt).toLocaleDateString('pt-BR')}</p></div>${urgencia ? `<div><p style="margin:0;color:var(--text-tertiary);font-size:11px;text-transform:uppercase">Urgência</p><p style="margin:2px 0 0">${urgencia}</p></div>` : ''}<div><p style="margin:0;color:var(--text-tertiary);font-size:11px;text-transform:uppercase">Status</p><p style="margin:2px 0 0"><span class="${r.status === 'REJEITADO' ? 'badge-red' : r.statusVirtual === 'PARCIAL' ? 'badge-yellow' : 'badge'}">${statusLabel}</span></p></div></div>${r.reviewData ? `<div style="background:var(--surface-brand);border:1px solid var(--brand-200);border-radius:6px;padding:10px 14px;margin-bottom:16px"><p style="margin:0;font-size:11px;font-weight:600;color:var(--brand-700);text-transform:uppercase">Revisão</p>${notaRevisao}<p style="margin:4px 0 0;font-size:11px;color:var(--brand-600)">${r.reviewData.reviewedAt ? new Date(r.reviewData.reviewedAt).toLocaleString('pt-BR') : ''}</p></div>` : ''}<table><thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:center">Unid.</th><th style="text-align:center">Aprovado</th><th style="text-align:center">Qtd Aprov.</th><th>Obs.</th></tr></thead><tbody>${itensHtml}</tbody></table><p style="margin-top:32px;font-size:10px;color:var(--text-tertiary)">Gerado em ${new Date().toLocaleString('pt-BR')} — Zelare</p></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const isPending = req?.status === 'SOLICITADO';
  const isProcessing = processando === reqId;
  const itens = req ? parseItensDetalhado(req) : [];
  const urgencia = req ? parseUrgencia(req) : undefined;
  const professor = req?.createdByUser
    ? `${req.createdByUser.firstName} ${req.createdByUser.lastName}`
    : '—';

  // Tem itens com ID (podem ser aprovados individualmente)
  const temItensComId = itemStates.length > 0;

  function toggleItemApproved(itemId: string) {
    setItemStates(prev => prev.map(s =>
      s.itemId === itemId
        ? { ...s, approved: !s.approved, qtyApproved: !s.approved ? s.qtyMax : 0 }
        : s
    ));
  }

  function setQtyApproved(itemId: string, qty: number) {
    setItemStates(prev => prev.map(s =>
      s.itemId === itemId
        ? { ...s, qtyApproved: Math.min(Math.max(0, qty), s.qtyMax), approved: qty > 0 }
        : s
    ));
  }

  function setItemReason(itemId: string, reason: string) {
    setItemStates(prev => prev.map(s =>
      s.itemId === itemId ? { ...s, reason } : s
    ));
  }

  function aprovarTodos() {
    setItemStates(prev => prev.map(s => ({ ...s, approved: true, qtyApproved: s.qtyMax })));
  }

  function rejeitarTodos() {
    setItemStates(prev => prev.map(s => ({ ...s, approved: false, qtyApproved: 0 })));
  }

  async function handleSalvarRevisaoPorItem() {
    if (!req) return;
    try {
      setProcessando(req.id);
      const items: ReviewItemDecision[] = itemStates.map(s => ({
        itemId: s.itemId,
        approved: s.approved,
        qtyApproved: s.qtyApproved,
        reason: s.reason || undefined,
      }));
      await reviewMaterialRequest(req.id, {
        decision: 'APPROVE_ITEMS',
        notes: notaGeral || undefined,
        items,
      });
      const allRejected = items.every(i => i.qtyApproved === 0);
      const allApproved = items.every(i => i.approved && i.qtyApproved > 0);
      const msg = allRejected
        ? 'Requisição rejeitada.'
        : allApproved
        ? 'Requisição aprovada com sucesso.'
        : 'Revisão salva: aprovação parcial.';
      setToast({ msg, tipo: 'ok' });
      onClose();
      onRevisaoSalva();
     } catch (e: unknown) {
      setToast({ msg: getErrorMessage(e, 'Erro ao salvar revisão. Tente novamente.'), tipo: 'erro' });
    } finally {
      setProcessando(null);
    }
  }
  async function handleAprovarTudo() {
    if (!req) return;
    try {
      setProcessando(req.id);
      await reviewMaterialRequest(req.id, { decision: 'APPROVED', notes: notaGeral || undefined });
      setToast({ msg: 'Requisição aprovada com sucesso.', tipo: 'ok' });
      onClose();
      onRevisaoSalva();
    } catch (e: unknown) {
      setToast({ msg: getErrorMessage(e, 'Erro ao aprovar. Tente novamente.'), tipo: 'erro' });
    } finally {
      setProcessando(null);
    }
  }

  // Calcula resumo da revisão atual
  const aprovados = itemStates.filter(s => s.approved && s.qtyApproved > 0).length;
  const rejeitados = itemStates.filter(s => !s.approved || s.qtyApproved === 0).length;
  const isParcialPreview = aprovados > 0 && rejeitados > 0;

  // Status virtual para exibir no detalhe
  const statusExibido = req?.statusVirtual ?? req?.status ?? 'SOLICITADO';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[var(--surface-overlay)] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[var(--surface-modal)] border-l border-[var(--border-default)] shadow-[var(--shadow-modal)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">Detalhe da Requisição</h2>
            {req && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{req.code}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {req && (req.status === 'APROVADO' || req.status === 'REJEITADO' || req.statusVirtual === 'PARCIAL') && (
              <button
                onClick={() => imprimirRequisicao(req)}
                title="Imprimir / Gerar PDF"
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--brand-600)] hover:bg-[var(--info-bg)] transition-colors"
              >
                <Printer className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)] gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              Carregando...
            </div>
          )}
          {erro && !loading && (
            <div className="text-[var(--error)] text-sm text-center py-8">{erro}</div>
          )}
          {req && !loading && (
            <>
              {/* Metadados */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">Professor</p>
                  <p className="font-medium text-[var(--text-primary)]">{professor}</p>
                  {req.createdByUser?.email && (
                    <p className="text-xs text-[var(--text-tertiary)]">{req.createdByUser.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">Turma</p>
                  <p className="font-medium text-[var(--text-primary)]">{req.classroom?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">Categoria</p>
                  <p className="font-medium text-[var(--text-primary)]">{getCategoryLabel(req.type)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">Data</p>
                  <p className="font-medium text-[var(--text-primary)]">
                    {new Date(req.requestedDate ?? req.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">Status</p>
                  <StatusBadge status={statusExibido} />
                </div>
                {urgencia && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">Urgência</p>
                    <UrgenciaBadge urgencia={urgencia} />
                  </div>
                )}
              </div>

              {/* Justificativa */}
              {req.justificativa && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Justificativa</p>
                  <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-inset)] rounded-md px-3 py-2">
                    {req.justificativa}
                  </p>
                </div>
              )}

              {/* Revisão anterior (se já revisada) */}
              {req.reviewData && (
                <div className="bg-[var(--info-bg)] border border-[var(--info-border)] rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-[var(--text-brand)] uppercase tracking-wide mb-1">Revisão anterior</p>
                  <p className="text-sm text-[var(--info)]">
                    {req.reviewData.isParcial ? 'Aprovação parcial' : req.reviewData.decision === 'REJECTED' ? 'Rejeitada' : 'Aprovada'}
                    {req.reviewData.notes && ` — ${req.reviewData.notes}`}
                  </p>
                  {req.reviewData.reviewedAt && (
                    <p className="text-xs text-[var(--brand-500)] mt-0.5">
                      {new Date(req.reviewData.reviewedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              )}

              {/* Grade de itens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                    {isPending && modoRevisao ? 'Revisão por Item' : 'Itens Solicitados'}
                  </p>
                  {isPending && temItensComId && !modoRevisao && (
                    <button
                      onClick={() => setModoRevisao(true)}
                      className="text-xs text-[var(--brand-600)] hover:text-[var(--info)] font-medium"
                    >
                      Revisar por item
                    </button>
                  )}
                  {isPending && modoRevisao && (
                    <div className="flex gap-2">
                      <button
                        onClick={aprovarTodos}
                        className="text-xs text-[var(--success)] hover:text-[var(--success)] font-medium"
                      >
                        Aprovar todos
                      </button>
                      <span className="text-[var(--text-disabled)]">|</span>
                      <button
                        onClick={rejeitarTodos}
                        className="text-xs text-[var(--error)] hover:text-[var(--error)] font-medium"
                      >
                        Rejeitar todos
                      </button>
                    </div>
                  )}
                </div>

                {itens.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)] italic">Nenhum item detalhado.</p>
                ) : modoRevisao && temItensComId ? (
                  /* Modo revisão por item */
                  <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--surface-inset)] text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                          <th className="px-3 py-2 text-left">Produto</th>
                          <th className="px-3 py-2 text-center w-16">Solicit.</th>
                          <th className="px-3 py-2 text-center w-20">Aprovar</th>
                          <th className="px-3 py-2 text-center w-20">Qtd Aprov.</th>
                          <th className="px-3 py-2 text-left">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {itens.map((item) => {
                          const state = item.id ? itemStates.find(s => s.itemId === item.id) : null;
                          return (
                            <tr key={item.id ?? item.item} className={state && !state.approved ? 'bg-[var(--error-bg)]' : state?.qtyApproved !== state?.qtyMax ? 'bg-[var(--warning-bg)]' : ''}>
                              <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                                {item.item}
                                {item.unidade && <span className="text-xs text-[var(--text-tertiary)] ml-1">({item.unidade})</span>}
                              </td>
                              <td className="px-3 py-2 text-center text-[var(--text-secondary)]">{item.quantidade}</td>
                              <td className="px-3 py-2 text-center">
                                {state ? (
                                  <button
                                    onClick={() => toggleItemApproved(state.itemId)}
                                    className={`inline-flex items-center justify-center transition-colors ${state.approved ? 'text-[var(--success)] hover:text-[var(--success)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-tertiary)]'}`}
                                  >
                                    {state.approved
                                      ? <CheckSquare className="h-5 w-5" />
                                      : <Square className="h-5 w-5" />
                                    }
                                  </button>
                                ) : (
                                  <span className="text-[var(--text-disabled)]">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {state ? (
                                  <input
                                    type="number"
                                    min={0}
                                    max={state.qtyMax}
                                    value={state.qtyApproved}
                                    onChange={e => setQtyApproved(state.itemId, parseInt(e.target.value) || 0)}
                                    className="w-16 text-center text-sm border border-[var(--border-strong)] rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[var(--brand-600)]"
                                  />
                                ) : (
                                  <span className="text-[var(--text-disabled)]">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {state ? (
                                  <input
                                    type="text"
                                    placeholder="Motivo (opcional)"
                                    value={state.reason}
                                    onChange={e => setItemReason(state.itemId, e.target.value)}
                                    className="w-full text-xs border border-[var(--border-default)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand-600)]"
                                  />
                                ) : (
                                  <span className="text-[var(--text-disabled)] text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Resumo da revisão */}
                    {itemStates.length > 0 && (
                      <div className={`px-3 py-2 text-xs font-medium border-t ${isParcialPreview ? 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]' : aprovados === itemStates.length ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]' : 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error-border)]'}`}>
                        {isParcialPreview
                          ? `Aprovação parcial: ${aprovados} aprovado(s), ${rejeitados} rejeitado(s)`
                          : aprovados === itemStates.length
                          ? 'Todos os itens serão aprovados'
                          : 'Todos os itens serão rejeitados'
                        }
                      </div>
                    )}
                  </div>
                ) : (
                  /* Modo visualização */
                  <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--surface-inset)] text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                          <th className="px-3 py-2 text-left">Produto</th>
                          <th className="px-3 py-2 text-center">Qtd</th>
                          <th className="px-3 py-2 text-left">Unid.</th>
                          {!isPending && <th className="px-3 py-2 text-center">Aprovado</th>}
                          {!isPending && <th className="px-3 py-2 text-center">Qtd Aprov.</th>}
                          <th className="px-3 py-2 text-left">Obs.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {itens.map((i, idx) => {
                          const dbItem = i.id ? req.items?.find(it => it.id === i.id) : null;
                          return (
                            <tr key={idx} className="hover:bg-[var(--surface-inset)]">
                              <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{i.item}</td>
                              <td className="px-3 py-2 text-center text-[var(--text-secondary)]">{i.quantidade}</td>
                              <td className="px-3 py-2 text-[var(--text-tertiary)]">{i.unidade ?? '—'}</td>
                              {!isPending && (
                                <td className="px-3 py-2 text-center">
                                  {dbItem?.approved === true
                                    ? <CheckCircle2 className="h-4 w-4 text-[var(--success)] mx-auto" />
                                    : dbItem?.approved === false
                                    ? <XCircle className="h-4 w-4 text-[var(--error)] mx-auto" />
                                    : <span className="text-[var(--text-disabled)]">—</span>
                                  }
                                </td>
                              )}
                              {!isPending && (
                                <td className="px-3 py-2 text-center text-[var(--text-secondary)]">
                                  {dbItem?.qtyApproved != null ? dbItem.qtyApproved : '—'}
                                </td>
                              )}
                              <td className="px-3 py-2 text-[var(--text-tertiary)] text-xs">
                                {dbItem?.approvalReason ?? i.observacao ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Nota geral (modo revisão) */}
              {isPending && modoRevisao && (
                <div>
                  <label className="block text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                    Nota geral (opcional)
                  </label>
                  <textarea
                    value={notaGeral}
                    onChange={e => setNotaGeral(e.target.value)}
                    placeholder="Observação geral para o professor..."
                    rows={2}
                    className="w-full text-sm border border-[var(--border-strong)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)] resize-none"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer com ações */}
        {req && isPending && (
          <div className="border-t border-[var(--border-default)] px-5 py-4 space-y-3">
            {modoRevisao && temItensComId ? (
              /* Ações do modo revisão por item */
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setModoRevisao(false)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarRevisaoPorItem}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--brand-600)] text-white rounded-lg hover:bg-[var(--brand-700)] disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isProcessing ? 'Salvando...' : 'Salvar Revisão'}
                </button>
              </div>
            ) : (
              /* Ações globais */
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => onRejeitar(req.id, req.title)}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error-border)] rounded-lg hover:bg-[var(--error-bg)] disabled:opacity-50 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Rejeitar
                </button>
                <button
                  onClick={handleAprovarTudo}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--success)] text-[var(--text-inverse)] rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isProcessing ? 'Aprovando...' : 'Aprovar Tudo'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function MaterialRequestApprovalTable() {
  const [tab, setTab] = useState<Tab>('pendentes');
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterClassroom, setFilterClassroom] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<MaterialCategory | ''>('');
  const [filterBusca, setFilterBusca] = useState('');
  const [classrooms, setClassrooms] = useState<AccessibleClassroom[]>([]);

  const [processando, setProcessando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);

  const [modalRejeitar, setModalRejeitar] = useState<{ id: string; titulo: string } | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [modalApagar, setModalApagar] = useState<{ id: string; titulo: string } | null>(null);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    getAccessibleClassrooms().then(setClassrooms).catch(() => setClassrooms([]));
  }, []);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const statusFiltro = TAB_STATUS[tab];
      const data = await listUnitMaterialRequests({
        ...(statusFiltro ? { status: statusFiltro } : {}),
        ...(filterClassroom ? { classroomId: filterClassroom } : {}),
        ...(filterCategoria ? { categoria: filterCategoria } : {}),
      });
      setRequests(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Não foi possível carregar as requisições.'));
    } finally {
      setLoading(false);
    }
  }, [tab, filterClassroom, filterCategoria]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const visiveis = filterBusca.trim()
    ? requests.filter(r => {
        const q = filterBusca.toLowerCase();
        const professor = r.createdByUser
          ? `${r.createdByUser.firstName} ${r.createdByUser.lastName} ${r.createdByUser.email}`.toLowerCase()
          : '';
        return (
          r.title.toLowerCase().includes(q) ||
          professor.includes(q) ||
          (r.classroom?.name ?? '').toLowerCase().includes(q)
        );
      })
    : requests;

  // Contadores por tab
  const pendentes = requests.filter(r => r.status === 'SOLICITADO').length;

  function handleAbrirRejeicao(id: string, titulo: string) {
    setModalRejeitar({ id, titulo });
    setMotivoRejeicao('');
    setDetalheId(null);
  }

  async function handleConfirmarApagar() {
    if (!modalApagar) return;
    try {
      setApagando(true);
      await import('../../api/http').then(m =>
        m.default.delete(`/material-requests/${modalApagar.id}`)
      );
      setToast({ msg: 'Requisição apagada.', tipo: 'ok' });
      setModalApagar(null);
      await carregar();
    } catch {
      setToast({ msg: 'Erro ao apagar. Tente novamente.', tipo: 'erro' });
    } finally {
      setApagando(false);
    }
  }

  async function handleConfirmarRejeicao() {
    if (!modalRejeitar) return;
    try {
      setProcessando(modalRejeitar.id);
      await reviewMaterialRequest(modalRejeitar.id, {
        decision: 'REJECTED',
        observacao: motivoRejeicao || undefined,
      });
      setToast({ msg: 'Requisição rejeitada.', tipo: 'ok' });
      setModalRejeitar(null);
      setMotivoRejeicao('');
      await carregar();
    } catch {
      setToast({ msg: 'Erro ao rejeitar. Tente novamente.', tipo: 'erro' });
    } finally {
      setProcessando(null);
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'pendentes', label: 'Pendentes', count: pendentes },
    { key: 'aprovadas', label: 'Aprovadas' },
    { key: 'todas', label: 'Todas' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Aprovação de Requisições</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Gerencie as solicitações de materiais dos professores da sua unidade.
        </p>
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.tipo === 'ok' ? 'bg-[var(--success)] text-[var(--text-inverse)]' : 'bg-[var(--error)] text-[var(--text-inverse)]'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex border-b border-[var(--border-default)]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === t.key
                ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                tab === t.key ? 'bg-[var(--info-bg)] text-[var(--text-brand)]' : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filterClassroom}
          onChange={e => setFilterClassroom(e.target.value)}
          className="text-sm border border-[var(--border-strong)] rounded-md px-3 py-1.5 bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]"
        >
          <option value="">Todas as turmas</option>
          {classrooms.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterCategoria}
          onChange={e => setFilterCategoria(e.target.value as MaterialCategory | '')}
          className="text-sm border border-[var(--border-strong)] rounded-md px-3 py-1.5 bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]"
        >
          <option value="">Todas as categorias</option>
          <option value="PEDAGOGICO">Pedagógico</option>
          <option value="HIGIENE">Higiene Pessoal</option>
          <option value="LIMPEZA">Limpeza</option>
          <option value="ALIMENTACAO">Alimentação</option>
          <option value="OUTRO">Outro</option>
        </select>
        <input
          type="text"
          placeholder="Buscar professor, turma ou item..."
          value={filterBusca}
          onChange={e => setFilterBusca(e.target.value)}
          className="text-sm border border-[var(--border-strong)] rounded-md px-3 py-1.5 flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]"
        />
      </div>

      <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)] text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando requisições...
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center py-12 text-[var(--error)] text-sm">{error}</div>
        )}
        {!loading && !error && visiveis.length === 0 && (
          <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)] text-sm">
            Nenhuma requisição encontrada.
          </div>
        )}
        {!loading && !error && visiveis.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-inset)] text-xs text-[var(--text-tertiary)] uppercase tracking-wide border-b border-[var(--border-default)]">
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Professor</th>
                  <th className="px-4 py-3 text-left">Turma</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-left">Itens</th>
                  <th className="px-4 py-3 text-left">Urgência</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {visiveis.map(req => {
                  const isPending = req.status === 'SOLICITADO';
                  const isProcessing = processando === req.id;
                  const urgencia = parseUrgencia(req);
                  const itensResumo = parseItensResumo(req);
                  const professor = req.createdByUser
                    ? `${req.createdByUser.firstName} ${req.createdByUser.lastName}`
                    : '—';
                  const email = req.createdByUser?.email ?? '';
                  const data = new Date(req.requestedDate ?? req.createdAt).toLocaleDateString('pt-BR');
                  // Usa statusVirtual se disponível (PARCIAL)
                  const statusExibido = req.statusVirtual ?? req.status;

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-[var(--surface-inset)] transition-colors cursor-pointer"
                      onClick={() => setDetalheId(req.id)}
                    >
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{data}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{professor}</div>
                        {email && <div className="text-xs text-[var(--text-tertiary)]">{email}</div>}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {req.classroom?.name ?? <span className="text-[var(--text-tertiary)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {getCategoryLabel(req.type)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs">
                        <span className="line-clamp-2">{itensResumo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <UrgenciaBadge urgencia={urgencia} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={statusExibido} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            onClick={() => setDetalheId(req.id)}
                            className="px-2.5 py-1 text-xs font-medium text-[var(--brand-600)] border border-[var(--info-border)] rounded hover:bg-[var(--info-bg)] transition-colors flex items-center gap-1"
                          >
                            Abrir
                            <ChevronRight className="h-3 w-3" />
                          </button>
                          {isPending && (
                            <button
                              onClick={() => handleAbrirRejeicao(req.id, req.title)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-medium bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error-border)] rounded hover:bg-[var(--error-bg)] disabled:opacity-50 transition-colors"
                            >
                              Rejeitar
                            </button>
                          )}
                          <button
                            onClick={() => setModalApagar({ id: req.id, titulo: req.title })}
                            disabled={isProcessing}
                            className="px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)] border border-[var(--border-default)] rounded hover:bg-[var(--surface-muted)] hover:text-[var(--error)] hover:border-[var(--error-border)] disabled:opacity-50 transition-colors"
                          >
                            Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetalheDrawer
        reqId={detalheId}
        onClose={() => setDetalheId(null)}
        onRevisaoSalva={carregar}
        onRejeitar={handleAbrirRejeicao}
        processando={processando}
        setProcessando={setProcessando}
        setToast={setToast}
      />

      {modalRejeitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-sm">
          <div className="ds-modal w-full max-w-md mx-4 p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-1">Rejeitar Requisição</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">{modalRejeitar.titulo}</p>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Motivo da rejeição <span className="text-[var(--error)]">*</span>
            </label>
            <textarea
              value={motivoRejeicao}
              onChange={e => setMotivoRejeicao(e.target.value)}
              placeholder="Obrigatório: descreva o motivo para o professor..."
              rows={3}
              className="w-full text-sm border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--error)] resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setModalRejeitar(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarRejeicao}
                disabled={!!processando || !motivoRejeicao.trim()}
                className="px-4 py-2 text-sm font-medium bg-[var(--error)] text-[var(--text-inverse)] rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors"
              >
                {processando ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalApagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-sm">
          <div className="ds-modal w-full max-w-md mx-4 p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-1">
              Apagar requisição?
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-1 line-clamp-2">
              {modalApagar.titulo}
            </p>
            <p className="text-sm text-[var(--error)] mb-6">
              Esta ação é permanente e não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalApagar(null)}
                disabled={apagando}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarApagar}
                disabled={apagando}
                className="px-4 py-2 text-sm font-medium bg-[var(--error)] text-[var(--text-inverse)] rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors"
              >
                {apagando ? 'Apagando...' : 'Sim, apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
