import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, HeartHandshake, Link2, LockKeyhole, RefreshCw, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { useAuth } from '../app/AuthProvider';
import { useUnitScope } from '../contexts/UnitScopeContext';
import { getAccessibleClassrooms } from '../api/lookup';
import {
  linkFamilyGuardian,
  listFamilyChildren,
  listFamilyGuardians,
  listGuardianCandidates,
  revokeFamilyGuardian,
  type FamilyChild,
  type FamilyGuardian,
  type FamilyGuardianCandidate,
  type FamilyPagination,
} from '../api/family';

function errorMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (message) return message;
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Pagination({ pagination, onPage }: { pagination: FamilyPagination | null; onPage: (page: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
      <span>Página {pagination.page} de {pagination.totalPages} · {pagination.total} registros</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Página anterior" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)} className="rounded-lg border border-[var(--border-default)] p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Próxima página" disabled={!pagination.hasNext} onClick={() => onPage(pagination.page + 1)} className="rounded-lg border border-[var(--border-default)] p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function FamilyGuardiansPage() {
  const { user } = useAuth();
  const { accessibleUnits, unitsLoading, selectedUnitId: globalUnitId, setUnit, unitSelectionLocked } = useUnitScope();
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string; code: string; unitId: string }>>([]);
  const [classroomsLoading, setClassroomsLoading] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [childrenPagination, setChildrenPagination] = useState<FamilyPagination | null>(null);
  const [childrenPage, setChildrenPage] = useState(1);
  const [childrenSearch, setChildrenSearch] = useState('');
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [guardians, setGuardians] = useState<FamilyGuardian[]>([]);
  const [guardiansLoading, setGuardiansLoading] = useState(false);
  const [candidates, setCandidates] = useState<FamilyGuardianCandidate[]>([]);
  const [candidatesPagination, setCandidatesPagination] = useState<FamilyPagination | null>(null);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [relationship, setRelationship] = useState('Responsável');
  const [isPrimary, setIsPrimary] = useState(false);
  const [canViewTimeline, setCanViewTimeline] = useState(true);
  const [canViewDevelopment, setCanViewDevelopment] = useState(false);
  const [canViewHealth, setCanViewHealth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedChild = useMemo(() => children.find((child) => child.id === selectedChildId), [children, selectedChildId]);
  const selectedUnit = useMemo(() => accessibleUnits.find((unit) => unit.id === selectedUnitId), [accessibleUnits, selectedUnitId]);

  useEffect(() => {
    const nextUnitId = globalUnitId ?? (unitSelectionLocked ? user?.unitId ?? user?.unit?.id ?? '' : '');
    setSelectedUnitId(nextUnitId);
  }, [globalUnitId, unitSelectionLocked, user]);

  useEffect(() => {
    setClassrooms([]);
    setSelectedClassroomId('');
    setChildren([]);
    setChildrenPagination(null);
    setSelectedChildId('');
    setGuardians([]);
    if (!selectedUnitId) return;
    let cancelled = false;
    setClassroomsLoading(true);
    getAccessibleClassrooms(selectedUnitId)
      .then((items) => { if (!cancelled) setClassrooms(items); })
      .catch((loadError) => { if (!cancelled) setError(errorMessage(loadError)); })
      .finally(() => { if (!cancelled) setClassroomsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedUnitId]);

  const loadChildren = useCallback(async (page = childrenPage) => {
    if (!selectedUnitId || !selectedClassroomId) {
      setChildren([]);
      setChildrenPagination(null);
      setSelectedChildId('');
      return;
    }
    setChildrenLoading(true);
    setError(null);
    try {
      const result = await listFamilyChildren({ unitId: selectedUnitId, classroomId: selectedClassroomId, search: childrenSearch || undefined, page, limit: 12, sortBy: 'firstName', sortOrder: 'asc' });
      setChildren(result.items);
      setChildrenPagination(result.pagination);
      setChildrenPage(page);
      setSelectedChildId((current) => result.items.some((child) => child.id === current) ? current : '');
    } catch (loadError) {
      setError(errorMessage(loadError));
      setChildren([]);
      setChildrenPagination(null);
      setSelectedChildId('');
    } finally { setChildrenLoading(false); }
  }, [childrenPage, childrenSearch, selectedClassroomId, selectedUnitId]);

  useEffect(() => { void loadChildren(1); }, [loadChildren, selectedClassroomId]);

  const loadCandidates = useCallback(async (page = candidatesPage) => {
    if (!selectedUnitId) {
      setCandidates([]);
      setCandidatesPagination(null);
      return;
    }
    setCandidatesLoading(true);
    try {
      const result = await listGuardianCandidates({ unitId: selectedUnitId, search: candidateSearch || undefined, page, limit: 10, sortBy: 'firstName', sortOrder: 'asc' });
      setCandidates(result.items);
      setCandidatesPagination(result.pagination);
      setCandidatesPage(page);
    } catch (loadError) {
      setError(errorMessage(loadError));
      setCandidates([]);
      setCandidatesPagination(null);
    } finally { setCandidatesLoading(false); }
  }, [candidateSearch, candidatesPage, selectedUnitId]);

  useEffect(() => { void loadCandidates(1); }, [loadCandidates, selectedUnitId]);

  const loadGuardians = useCallback(async (childId: string) => {
    if (!childId) { setGuardians([]); return; }
    setGuardiansLoading(true);
    try { setGuardians(await listFamilyGuardians(childId)); }
    catch (loadError) { setError(errorMessage(loadError)); }
    finally { setGuardiansLoading(false); }
  }, []);

  function handleUnitChange(unitId: string) {
    if (unitSelectionLocked) return;
    setUnit(unitId || null);
    setSelectedUnitId(unitId);
    setSelectedClassroomId('');
    setSelectedChildId('');
    setGuardians([]);
    setNotice(null);
  }

  function handleClassroomChange(classroomId: string) {
    setSelectedClassroomId(classroomId);
    setSelectedChildId('');
    setGuardians([]);
    setNotice(null);
  }

  async function selectChild(childId: string) {
    setSelectedChildId(childId);
    setError(null);
    setNotice(null);
    await loadGuardians(childId);
  }

  async function handleLink(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedChildId || !selectedUserId || relationship.trim().length < 2) {
      setError('Selecione unidade, turma, criança, responsável e informe o vínculo.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await linkFamilyGuardian(selectedChildId, { userId: selectedUserId, relationship: relationship.trim(), isPrimary, canViewTimeline, canViewDevelopment, canViewHealth });
      setNotice('Vínculo salvo com consentimentos registrados.');
      setSelectedUserId('');
      await loadGuardians(selectedChildId);
    } catch (saveError) { setError(errorMessage(saveError)); }
    finally { setSaving(false); }
  }

  async function handleRevoke(guardian: FamilyGuardian) {
    if (!selectedChildId || guardian.revokedAt) return;
    if (!window.confirm(`Revogar o vínculo de ${guardian.user.firstName} ${guardian.user.lastName}?`)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await revokeFamilyGuardian(selectedChildId, guardian.userId);
      setNotice('Vínculo revogado. O acesso familiar foi bloqueado imediatamente.');
      await loadGuardians(selectedChildId);
    } catch (revokeError) { setError(errorMessage(revokeError)); }
    finally { setSaving(false); }
  }

  return (
    <PageShell title="Vínculos familiares" subtitle="Famílias e LGPD">
      <div className="space-y-6">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-inset)] px-4 py-3 text-sm text-[var(--text-primary)]"><ShieldCheck className="mr-2 inline h-4 w-4 text-[var(--text-brand)]" /> Acesso limitado à organização e às unidades autorizadas.</div>
        {(error || notice) && <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-300 bg-red-50 text-red-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>{error || notice}</div>}

        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm" aria-labelledby="scope-title">
          <div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-[var(--text-brand)]" /><div><h2 id="scope-title" className="font-semibold text-[var(--text-primary)]">Selecione o escopo</h2><p className="text-xs text-[var(--text-secondary)]">Organização → unidade → turma → criança</p></div></div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-[var(--text-primary)]">Organização<input value={user?.mantenedoraId ?? 'Organização atual'} readOnly className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-[var(--text-secondary)]" /></label>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Unidade<select value={selectedUnitId} onChange={(event) => handleUnitChange(event.target.value)} disabled={unitsLoading || unitSelectionLocked} className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-70"><option value="">Selecione uma unidade...</option>{accessibleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select>{unitSelectionLocked && <span className="mt-1 block text-xs text-[var(--text-secondary)]">Unidade fixa pelo perfil.</span>}</label>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Turma<select value={selectedClassroomId} onChange={(event) => handleClassroomChange(event.target.value)} disabled={!selectedUnitId || classroomsLoading} className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-70"><option value="">{classroomsLoading ? 'Carregando turmas...' : 'Selecione uma turma...'}</option>{classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name} · {classroom.code}</option>)}</select></label>
          </div>
          {selectedUnit && <p className="mt-3 text-xs text-[var(--text-secondary)]">Unidade ativa: {selectedUnit.name}</p>}
        </section>

        {!selectedUnitId && <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card)] p-10 text-center text-sm text-[var(--text-secondary)]">Selecione uma unidade para continuar.</div>}
        {selectedUnitId && !selectedClassroomId && <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card)] p-10 text-center text-sm text-[var(--text-secondary)]">Selecione uma turma para listar as crianças.</div>}

        {selectedUnitId && selectedClassroomId && <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3"><HeartHandshake className="h-5 w-5 text-[var(--text-brand)]" /><div className="mr-auto"><h2 className="font-semibold text-[var(--text-primary)]">Crianças</h2><p className="text-xs text-[var(--text-secondary)]">Escolha uma criança para consultar ou vincular responsáveis.</p></div><input aria-label="Buscar criança" value={childrenSearch} onChange={(event) => setChildrenSearch(event.target.value)} placeholder="Buscar criança..." className="w-full max-w-xs rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]" /><button type="button" onClick={() => void loadChildren(1)} disabled={childrenLoading} className="rounded-lg border border-[var(--border-default)] p-2 text-[var(--text-secondary)]" aria-label="Atualizar crianças"><RefreshCw className={`h-4 w-4 ${childrenLoading ? 'animate-spin' : ''}`} /></button></div>
          {childrenLoading && <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Carregando crianças...</p>}
          {!childrenLoading && children.length === 0 && <p className="rounded-xl border border-dashed border-[var(--border-default)] p-6 text-center text-sm text-[var(--text-secondary)]">Nenhuma criança encontrada nesta turma.</p>}
          {!childrenLoading && children.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children.map((child) => <button key={child.id} type="button" onClick={() => void selectChild(child.id)} className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${child.id === selectedChildId ? 'border-[var(--brand-500)] bg-[var(--surface-brand)] text-[var(--text-primary)]' : 'border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-inset)]'}`}><span className="block font-medium">{child.firstName} {child.lastName}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">Matrícula ativa · {child.activeEnrollment?.classroom.name ?? '—'}</span></button>)}</div>}
          <div className="mt-4"><Pagination pagination={childrenPagination} onPage={(page) => void loadChildren(page)} /></div>
        </section>}

        {selectedChild && <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm"><div className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-[var(--text-brand)]" /><div><h2 className="font-semibold text-[var(--text-primary)]">Vincular responsável</h2><p className="text-xs text-[var(--text-secondary)]">{selectedChild.firstName} {selectedChild.lastName}</p></div></div><form onSubmit={handleLink} className="mt-5 space-y-4"><label className="block text-sm font-medium text-[var(--text-primary)]">Conta familiar ativa<input aria-label="Buscar responsável" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Buscar por nome ou e-mail..." className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]" /><select required value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-2 block w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]"><option value="">{candidatesLoading ? 'Carregando contas...' : 'Selecione uma conta...'}</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.firstName} {candidate.lastName} · {candidate.email}</option>)}</select><span className="mt-1 block text-xs text-[var(--text-secondary)]">Somente contas ativas e elegíveis da mesma organização.</span></label><label className="block text-sm font-medium text-[var(--text-primary)]">Relação<input required minLength={2} maxLength={80} value={relationship} onChange={(event) => setRelationship(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label><div className="space-y-2 rounded-xl bg-[var(--surface-inset)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Consentimentos</p><label className="flex items-start gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} className="mt-1" />Responsável principal</label><label className="flex items-start gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={canViewTimeline} onChange={(event) => setCanViewTimeline(event.target.checked)} className="mt-1" />Pode visualizar a timeline publicada</label><label className="flex items-start gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={canViewDevelopment} onChange={(event) => setCanViewDevelopment(event.target.checked)} className="mt-1" />Pode visualizar desenvolvimento</label><label className="flex items-start gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={canViewHealth} onChange={(event) => setCanViewHealth(event.target.checked)} className="mt-1" />Pode visualizar informações de saúde</label></div><button type="submit" disabled={saving || !selectedUserId || candidates.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-600)] px-3 py-2 text-sm font-medium text-[var(--text-inverse)] hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-50"><Link2 className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar vínculo'}</button><Pagination pagination={candidatesPagination} onPage={(page) => void loadCandidates(page)} /></form></section>

          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm"><div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-[var(--text-brand)]" /><div><h2 className="font-semibold text-[var(--text-primary)]">Vínculos e permissões</h2><p className="text-xs text-[var(--text-secondary)]">Cada alteração tem data e auditoria do ator.</p></div></div><div className="mt-5 space-y-3">{guardiansLoading && <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Carregando vínculos...</p>}{!guardiansLoading && guardians.length === 0 && <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-inset)] p-6 text-center text-sm text-[var(--text-secondary)]">Nenhum responsável vinculado ainda.</div>}{!guardiansLoading && guardians.map((guardian) => <article key={guardian.id} className={`rounded-xl border p-4 ${guardian.revokedAt ? 'border-[var(--border-default)] bg-[var(--surface-inset)] opacity-70' : 'border-emerald-300 bg-emerald-50/40'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[var(--text-primary)]">{guardian.user.firstName} {guardian.user.lastName}</p><p className="text-sm text-[var(--text-secondary)]">{guardian.user.email} · {guardian.relationship}{guardian.isPrimary ? ' · Principal' : ''}</p></div>{guardian.revokedAt ? <span className="rounded-full bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--text-secondary)]">Revogado</span> : <button type="button" onClick={() => void handleRevoke(guardian)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs text-red-800 hover:bg-red-50"><UserMinus className="h-3 w-3" />Revogar</button>}</div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs ${guardian.canViewTimeline ? 'bg-indigo-100 text-indigo-800' : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'}`}>Timeline {guardian.canViewTimeline ? 'permitida' : 'bloqueada'}</span><span className={`rounded-full px-2 py-1 text-xs ${guardian.canViewDevelopment ? 'bg-cyan-100 text-cyan-900' : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'}`}>Desenvolvimento {guardian.canViewDevelopment ? 'permitido' : 'bloqueado'}</span><span className={`rounded-full px-2 py-1 text-xs ${guardian.canViewHealth ? 'bg-violet-100 text-violet-900' : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'}`}>Saúde {guardian.canViewHealth ? 'permitida' : 'bloqueada'}</span></div><p className="mt-3 text-xs text-[var(--text-secondary)]">Consentimento: {formatDate(guardian.consentAt)} · Registro: {formatDate(guardian.createdAt)}{guardian.revokedAt ? ` · Revogado em ${formatDate(guardian.revokedAt)}` : ''}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Auditoria: {guardian.audit?.[0]?.actor ? `${guardian.audit[0].actor.firstName} ${guardian.audit[0].actor.lastName}` : 'ator registrado'} · {formatDate(guardian.audit?.[0]?.occurredAt)}</p></article>)}</div></section>
        </div>}

        <footer className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-inset)] px-4 py-3 text-xs text-[var(--text-secondary)]"><CheckCircle2 className="mr-1 inline h-4 w-4 text-[var(--text-brand)]" /> Saúde protegida por consentimento específico e revogação imediata.</footer>
      </div>
    </PageShell>
  );
}
