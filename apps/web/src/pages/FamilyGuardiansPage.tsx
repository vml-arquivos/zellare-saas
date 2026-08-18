import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HeartHandshake, Link2, LockKeyhole, RefreshCw, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { listFamilyChildren, listFamilyGuardians, linkFamilyGuardian, revokeFamilyGuardian, type FamilyChild, type FamilyGuardian } from '../api/family';
import http from '../api/http';

interface FamilyUserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  roles?: Array<{ roleType?: string }>;
}

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

export default function FamilyGuardiansPage() {
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [users, setUsers] = useState<FamilyUserOption[]>([]);
  const [guardians, setGuardians] = useState<FamilyGuardian[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [relationship, setRelationship] = useState('Responsável');
  const [isPrimary, setIsPrimary] = useState(false);
  const [canViewTimeline, setCanViewTimeline] = useState(true);
  const [canViewDevelopment, setCanViewDevelopment] = useState(false);
  const [canViewHealth, setCanViewHealth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedChild = useMemo(() => children.find((child) => child.id === selectedChildId), [children, selectedChildId]);
  const activeUsers = useMemo(() => users.filter((user) => user.status === 'ATIVO'), [users]);

  const loadGuardians = useCallback(async (childId: string) => {
    if (!childId) {
      setGuardians([]);
      return;
    }
    setGuardians(await listFamilyGuardians(childId));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [childrenData, usersResponse] = await Promise.all([
        listFamilyChildren(),
        http.get('/admin/users?limit=200'),
      ]);
      const rawUsers = usersResponse.data;
      const userList = (Array.isArray(rawUsers) ? rawUsers : (rawUsers?.data ?? rawUsers?.users ?? rawUsers?.items ?? [])) as FamilyUserOption[];
      setChildren(childrenData);
      setUsers(userList.filter((user) => user.roles?.some((role) => role.roleType === 'FAMILIA_RESPONSAVEL')));
      const childId = selectedChildId || childrenData[0]?.id || '';
      setSelectedChildId(childId);
      if (childId) setGuardians(await listFamilyGuardians(childId));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function selectChild(childId: string) {
    setSelectedChildId(childId);
    setError(null);
    try {
      await loadGuardians(childId);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }

  async function handleLink(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedChildId || !selectedUserId || relationship.trim().length < 2) {
      setError('Selecione a criança, o responsável e informe o vínculo.');
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
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
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
    } catch (revokeError) {
      setError(errorMessage(revokeError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title="Vínculos familiares" subtitle="Associe responsáveis reais às crianças e registre consentimentos granulares para a timeline protegida.">
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900"><ShieldCheck className="mr-2 inline h-4 w-4" /> A família só acessa crianças vinculadas, e desenvolvimento/saúde permanecem desativados por padrão até consentimento explícito.</div>
        {(error || notice) && <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Users className="h-5 w-5 text-indigo-600" /><div className="mr-auto"><p className="font-semibold text-slate-900">Crianças no escopo</p><p className="text-xs text-slate-500">A seleção é filtrada pela mantenedora/unidade do usuário.</p></div>{children.map((child) => <button key={child.id} type="button" onClick={() => void selectChild(child.id)} className={`rounded-xl px-3 py-2 text-sm ${child.id === selectedChildId ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{child.firstName} {child.lastName}</button>)}<button type="button" onClick={() => void loadData()} disabled={loading} className="rounded-lg border border-slate-300 p-2 text-slate-600" title="Atualizar"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></section>

        {!loading && children.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Nenhuma criança disponível no escopo atual.</div>}
        {selectedChild && <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-900">Vincular responsável</h2><p className="text-xs text-slate-500">{selectedChild.firstName} {selectedChild.lastName}</p></div></div><form onSubmit={handleLink} className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">Conta familiar ativa<select required value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Selecione uma conta...</option>{activeUsers.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {user.email}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Relação<input required minLength={2} maxLength={80} value={relationship} onChange={(event) => setRelationship(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><div className="space-y-2 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consentimentos</p><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} className="mt-1" />Responsável principal</label><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={canViewTimeline} onChange={(event) => setCanViewTimeline(event.target.checked)} className="mt-1" />Pode visualizar a timeline publicada</label><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={canViewDevelopment} onChange={(event) => setCanViewDevelopment(event.target.checked)} className="mt-1" />Pode visualizar desenvolvimento (consentimento específico)</label><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={canViewHealth} onChange={(event) => setCanViewHealth(event.target.checked)} className="mt-1" />Pode visualizar informações de saúde (consentimento específico)</label></div><button type="submit" disabled={saving || activeUsers.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Link2 className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar vínculo e consentimentos'}</button>{activeUsers.length === 0 && <p className="text-xs text-amber-700">Crie primeiro uma conta com o perfil FAMILIA_RESPONSAVEL na gestão de usuários.</p>}</form></section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-emerald-600" /><div><h2 className="font-semibold text-slate-900">Vínculos e permissões</h2><p className="text-xs text-slate-500">Consentimento concedido em cada vínculo é auditável.</p></div></div><div className="mt-5 space-y-3">{guardians.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Nenhum responsável vinculado ainda.</div>}{guardians.map((guardian) => <article key={guardian.id} className={`rounded-xl border p-4 ${guardian.revokedAt ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-emerald-100 bg-emerald-50/40'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{guardian.user.firstName} {guardian.user.lastName}</p><p className="text-sm text-slate-600">{guardian.user.email} · {guardian.relationship}{guardian.isPrimary ? ' · Principal' : ''}</p></div>{guardian.revokedAt ? <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600">Revogado</span> : <button type="button" onClick={() => void handleRevoke(guardian)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"><UserMinus className="h-3 w-3" />Revogar</button>}</div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs ${guardian.canViewTimeline ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>Timeline {guardian.canViewTimeline ? 'permitida' : 'bloqueada'}</span><span className={`rounded-full px-2 py-1 text-xs ${guardian.canViewDevelopment ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>Desenvolvimento {guardian.canViewDevelopment ? 'permitido' : 'bloqueado'}</span><span className={`rounded-full px-2 py-1 text-xs ${guardian.canViewHealth ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>Saúde {guardian.canViewHealth ? 'permitida' : 'bloqueada'}</span></div><p className="mt-3 text-xs text-slate-500">Consentimento: {formatDate(guardian.consentAt)}{guardian.revokedAt ? ` · Revogado em ${formatDate(guardian.revokedAt)}` : ''}</p></article>)}</div></section>
        </div>}

        <footer className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" /> Este fluxo não cria contas automaticamente, não envia senhas e não expõe dados de saúde na timeline familiar. A revogação desativa todas as permissões do vínculo no backend.</footer>
      </div>
    </PageShell>
  );
}
