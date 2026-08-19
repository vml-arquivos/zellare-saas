import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HeartPulse,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { useAuth } from '../app/AuthProvider';
import { hasRole } from '../api/auth';
import { getChildCareOverview, listCareChildren, type CareChildOption, type CareOverview } from '../api/care';
import { getOperationalAlerts, resolveOperationalAlert, type OperationalAlert } from '../api/alerts';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function errorMessage(error: unknown) {
  const responseMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(responseMessage)) return responseMessage.join(', ');
  if (responseMessage) return responseMessage;
  if (error instanceof Error) return error.message;
  return 'Não foi possível carregar a visão integrada de cuidado.';
}

function signal(value?: boolean | string | null) {
  if (typeof value === 'string' && value.trim()) return value;
  return value ? 'Informação registrada' : 'Não informado';
}

function text(value?: string | null) {
  return value?.trim() || 'Sem registro disponível.';
}

const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  CHILD_PROFILE: 'Cadastro da criança',
  DIARY_EVENT: 'Diário de Bordo',
  DEVELOPMENT_OBSERVATION: 'Observações de desenvolvimento',
  ATTENDANCE: 'Presença',
  FAMILY_COMMUNICATION: 'Comunicação familiar',
  ATENDIMENTO_PAIS: 'Atendimentos com a família',
  NUTRITIONAL_FOLLOW_UP: 'Acompanhamento nutricional',
  DIETARY_RESTRICTION: 'Restrições alimentares',
  RDIX_INSTANCE: 'Documento RDIC/RDX',
  DEVELOPMENT_REPORT: 'Relatório de desenvolvimento',
  ALERTA_ALUNO: 'Alertas',
};

function evidenceSourceLabel(source: string) {
  return EVIDENCE_SOURCE_LABELS[source] ?? source.replaceAll('_', ' ');
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Activity; tone: string }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tone}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, tone = 'border-slate-200 bg-white' }: { title: string; icon: typeof Activity; children: React.ReactNode; tone?: string }) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${tone}`}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-indigo-600" />
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">{children}</p>;
}

export default function CareOverviewPage() {
  const navigate = useNavigate();
  const { childId: routeChildId } = useParams<{ childId?: string }>();
  const [children, setChildren] = useState<CareChildOption[]>([]);
  const [overview, setOverview] = useState<CareOverview | null>(null);
  const [selectedId, setSelectedId] = useState(routeChildId ?? '');
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlert[]>([]);
  const [resolvingAlertId, setResolvingAlertId] = useState('');
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const canResolveAlerts = ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'].some((role) => hasRole(user, role));

  const selectedChild = useMemo(() => children.find((child) => child.id === selectedId), [children, selectedId]);

  const loadChildren = useCallback(async () => {
    setLoadingChildren(true);
    setError(null);
    try {
      const data = await listCareChildren();
      setChildren(data);
      setSelectedId((current) => {
        if (routeChildId && data.some((child) => child.id === routeChildId)) return routeChildId;
        return current && data.some((child) => child.id === current) ? current : data[0]?.id ?? '';
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
      setChildren([]);
    } finally {
      setLoadingChildren(false);
    }
  }, [routeChildId]);

  const loadOverview = useCallback(async (childId: string) => {
    setLoadingOverview(true);
    setError(null);
    setAlertNotice(null);
    try {
      setOverview(await getChildCareOverview(childId));
    } catch (loadError) {
      setOverview(null);
      setOperationalAlerts([]);
      setError(errorMessage(loadError));
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadOperationalAlerts = useCallback(async () => {
    if (!overview?.child?.activeClassrooms?.length || !selectedId) {
      setOperationalAlerts([]);
      return;
    }
    try {
      const classroomId = overview.child.activeClassrooms[0]?.id;
      const summary = await getOperationalAlerts({ classroomId, limit: 100, unread: true });
      setOperationalAlerts(summary.alertas.filter((alert) => !alert.childId || alert.childId === selectedId));
    } catch {
      setOperationalAlerts([]);
    }
  }, [overview, selectedId]);

  useEffect(() => { void loadChildren(); }, [loadChildren]);

  useEffect(() => {
    if (selectedId) void loadOverview(selectedId);
    else {
      setOverview(null);
      setOperationalAlerts([]);
    }
  }, [loadOverview, selectedId]);

  useEffect(() => { void loadOperationalAlerts(); }, [loadOperationalAlerts]);

  async function resolveAlert(alertId: string) {
    if (!canResolveAlerts) return;
    setResolvingAlertId(alertId);
    setError(null);
    setAlertNotice(null);
    try {
      await resolveOperationalAlert(alertId);
      setOperationalAlerts((current) => current.filter((alert) => alert.id !== alertId));
      setAlertNotice('Alerta marcado como resolvido com registro do responsável.');
      if (selectedId) void loadOverview(selectedId);
    } catch (resolveError) {
      setError(errorMessage(resolveError));
    } finally {
      setResolvingAlertId('');
    }
  }

  function selectChild(childId: string) {
    setSelectedId(childId);
    navigate(`/app/cuidado/${childId}`);
  }

  return (
    <PageShell title="Cuidado integrado" subtitle="Cuidado, alimentação e família.">
      <div className="space-y-6">
        <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-700"><HeartPulse className="h-4 w-4" /> Visão somente leitura e com revisão humana</div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Acompanhe a criança como um todo</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Resumo protegido do cuidado.</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="care-child" className="sr-only">Selecionar criança</label>
              <select id="care-child" value={selectedId} onChange={(event) => selectChild(event.target.value)} disabled={loadingChildren || children.length === 0} className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                <option value="">Selecionar criança</option>
                {children.map((child) => <option key={child.id} value={child.id}>{child.firstName} {child.lastName}{child.classroomName ? ` · ${child.classroomName}` : ''}</option>)}
              </select>
              <button type="button" onClick={() => { void loadChildren(); if (selectedId) void loadOverview(selectedId); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" title="Atualizar dados">
                <RefreshCw className="h-4 w-4" /> Atualizar
              </button>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {alertNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{alertNotice}</div>}

        {loadingChildren && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Carregando crianças do seu escopo...</div>}
        {!loadingChildren && children.length === 0 && <EmptyState>Nenhuma criança disponível no escopo atual para a visão de cuidado.</EmptyState>}
        {loadingOverview && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Carregando registros integrados...</div>}

        {!loadingOverview && overview && (
          <>
            <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Criança selecionada</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">{overview.child.firstName} {overview.child.lastName}</h2>
                <p className="mt-1 text-sm text-slate-500">Nascimento: {formatDate(overview.child.dateOfBirth)} · {overview.child.activeClassrooms.map((classroom) => classroom.name).join(', ') || 'Sem turma ativa'}</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"><ShieldCheck className="h-4 w-4" /> Dados filtrados por papel e escopo</div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Alertas ativos" value={overview.alerts.length} icon={AlertTriangle} tone="border-amber-200 bg-amber-50 text-amber-900" />
              <SummaryCard label="Observações de desenvolvimento" value={overview.development.length} icon={Activity} tone="border-indigo-200 bg-indigo-50 text-indigo-900" />
              <SummaryCard label="Acompanhamentos nutricionais" value={overview.nutrition.length} icon={Utensils} tone="border-emerald-200 bg-emerald-50 text-emerald-900" />
              <SummaryCard label="Registros de família" value={overview.familyCare.length + overview.reports.length} icon={MessageCircle} tone="border-sky-200 bg-sky-50 text-sky-900" />
            </section>

            {overview.evidenceSummary && (
              <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-violet-800"><ShieldCheck className="h-4 w-4" /> Cobertura unificada da criança</div>
                    <p className="mt-1 text-sm text-slate-600">Registros do cuidado.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-800">Revisão humana obrigatória</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Evidências armazenadas" value={overview.evidenceSummary.total} icon={ClipboardCheck} tone="border-violet-200 bg-white text-violet-900" />
                  <SummaryCard label="Fontes integradas" value={Object.keys(overview.evidenceSummary.bySource).length} icon={Activity} tone="border-violet-200 bg-white text-violet-900" />
                  <SummaryCard label="Tipos registrados" value={Object.keys(overview.evidenceSummary.byType).length} icon={FileText} tone="border-violet-200 bg-white text-violet-900" />
                  <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">Última captura</p><p className="mt-3 text-sm font-semibold text-violet-900">{formatDateTime(overview.evidenceSummary.lastCapturedAt)}</p><p className="mt-1 text-xs text-slate-500">Fonte rastreável no armazenamento central.</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Fontes de evidência">
                  {Object.entries(overview.evidenceSummary.bySource).map(([source, count]) => <span key={source} className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800">{evidenceSourceLabel(source)} · {count}</span>)}
                </div>
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="Saúde, alergias e alimentação" icon={Utensils} tone="border-emerald-200 bg-emerald-50/40">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Alergias</p><p className="mt-1 text-sm font-semibold text-slate-800">{signal(overview.health.allergies)}</p></div>
                  <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Condições médicas</p><p className="mt-1 text-sm font-semibold text-slate-800">{signal(overview.health.medicalConditions)}</p></div>
                  <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Medicação</p><p className="mt-1 text-sm font-semibold text-slate-800">{signal(overview.health.medicationNeeds)}</p></div>
                </div>
                <div className="mt-4 space-y-3">
                  {overview.health.dietaryRestrictions.length === 0 && <EmptyState>Nenhuma restrição alimentar ativa registrada.</EmptyState>}
                  {overview.health.dietaryRestrictions.map((restriction) => <div key={restriction.id} className="rounded-xl border border-emerald-100 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-800">{restriction.name}</p><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">{restriction.severity || restriction.type}</span></div><p className="mt-2 text-sm text-slate-600">{text(restriction.description)}</p>{restriction.forbiddenFoods && <p className="mt-2 text-xs text-rose-700"><strong>Evitar:</strong> {restriction.forbiddenFoods}</p>}</div>)}
                </div>
              </SectionCard>

              <SectionCard title="Alertas e próximos cuidados" icon={AlertTriangle} tone="border-amber-200 bg-amber-50/40">
                {overview.alerts.length === 0 && <EmptyState>Nenhum alerta ativo no momento.</EmptyState>}
                <div className="space-y-3">{overview.alerts.map((alert) => <div key={alert.id} className="rounded-xl border border-amber-100 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-800">{alert.titulo}</p><p className="mt-1 text-sm text-slate-600">{text(alert.descricao)}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{alert.status || 'Ativo'}</span></div><p className="mt-3 text-xs text-slate-400">Gerado em {formatDateTime(alert.geradoEm)}</p></div>)}</div>
              </SectionCard>
            </div>

            <SectionCard title="Fila operacional — revisão humana" icon={AlertTriangle} tone="border-rose-200 bg-rose-50/40">
              {operationalAlerts.length === 0 && <EmptyState>Nenhum alerta operacional ativo para esta criança.</EmptyState>}
              <div className="space-y-3">{operationalAlerts.map((alert) => <article key={alert.id} className="rounded-xl border border-rose-100 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-800">{alert.titulo}</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${alert.severidade === 'CRITICA' || alert.severidade === 'ALTA' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{alert.severidade}</span></div><p className="mt-1 text-sm text-slate-600">{text(alert.descricao)}</p><p className="mt-2 text-xs text-slate-400">Gerado em {formatDateTime(alert.criadoEm)} · decisão humana obrigatória</p></div>{canResolveAlerts && <button type="button" disabled={resolvingAlertId === alert.id} onClick={() => void resolveAlert(alert.id)} className="shrink-0 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">{resolvingAlertId === alert.id ? 'Salvando...' : 'Resolver'}</button>}</div></article>)}</div>
            </SectionCard>

            <SectionCard title="Desenvolvimento observado" icon={Activity}>
              {overview.development.length === 0 && <EmptyState>Nenhuma observação de desenvolvimento no período carregado.</EmptyState>}
              <div className="space-y-4">{overview.development.map((observation) => <article key={observation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">{observation.category || 'Observação'}</span><span className="text-xs text-slate-400">{formatDate(observation.date)}</span></div><ClipboardCheck className="h-4 w-4 text-emerald-600" /></div><p className="mt-3 text-sm leading-6 text-slate-700">{text(observation.behaviorDescription || observation.learningProgress)}</p>{(observation.interests || observation.nextSteps) && <div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-lg bg-white p-3"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Interesses</p><p className="mt-1 text-sm text-slate-600">{text(observation.interests)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Próximos passos</p><p className="mt-1 text-sm text-slate-600">{text(observation.nextSteps)}</p></div></div>}</article>)}</div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="Acompanhamentos nutricionais" icon={Utensils}>
                {overview.nutrition.length === 0 && <EmptyState>Nenhum acompanhamento nutricional ativo.</EmptyState>}
                <div className="space-y-3">{overview.nutrition.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium text-slate-800">{item.motivoAcompanhamento || 'Acompanhamento ativo'}</p><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">{item.statusCaso || 'Ativo'}</span></div><p className="mt-2 text-sm text-slate-600">{text(item.condutaAtual || item.objetivos)}</p><p className="mt-3 text-xs text-slate-400">Próxima reavaliação: {formatDate(item.proximaReavaliacao)}</p></div>)}</div>
              </SectionCard>

              <SectionCard title="Família e relatórios" icon={MessageCircle}>
                {overview.familyCare.length === 0 && overview.reports.length === 0 && <EmptyState>Nenhum atendimento familiar ou relatório carregado.</EmptyState>}
                <div className="space-y-3">{overview.familyCare.map((meeting) => <div key={meeting.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium text-slate-800">{meeting.assunto || meeting.tipo || 'Atendimento familiar'}</p><span className="text-xs text-slate-400">{formatDate(meeting.dataAtendimento)}</span></div><p className="mt-2 text-sm text-slate-600">{text(meeting.descricao)}</p></div>)}{overview.reports.map((report) => <div key={report.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-600" /><p className="font-medium text-slate-800">Relatório {report.period || 'de desenvolvimento'}</p><span className="ml-auto text-xs text-slate-400">{formatDate(report.publishedAt || report.createdAt)}</span></div><p className="mt-2 text-sm text-slate-600">{text(report.content)}</p></div>)}</div>
              </SectionCard>
            </div>

            <footer className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between"><span><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" /> Visão gerada em {formatDateTime(overview.governance.generatedAt)} · somente leitura</span><span>{overview.governance.sensitiveFieldsMinimized ? 'Campos protegidos.' : 'Acesso protegido.'} Revisão humana obrigatória.</span></footer>
          </>
        )}

        {!loadingOverview && !overview && selectedChild && !error && <EmptyState>Selecione uma criança para carregar a visão integrada.</EmptyState>}
      </div>
    </PageShell>
  );
}
