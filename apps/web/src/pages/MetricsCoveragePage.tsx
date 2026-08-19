import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, HeartPulse, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { getCoverageOverview, type CoverageOverview } from '../api/metrics';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function errorMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (message) return message;
  if (error instanceof Error) return error.message;
  return 'Não foi possível carregar as métricas reais.';
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Activity; tone: string }) {
  return <div className={`rounded-2xl border p-5 shadow-sm ${tone}`}><Icon className="h-5 w-5" /><p className="mt-3 text-2xl font-semibold">{value}</p><p className="text-xs opacity-80">{label}</p></div>;
}

function CoverageBar({ label, value, description }: { label: string; value: number; description: string }) {
  return <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-700">{label}</p><strong className="text-sm text-slate-900">{value.toFixed(1)}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div><p className="mt-1 text-xs text-slate-500">{description}</p></div>;
}

export default function MetricsCoveragePage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<CoverageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setOverview(await getCoverageOverview(days));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [days]);

  return <PageShell title="Cobertura e observabilidade" subtitle="Indicadores agregados."><div className="space-y-6">
    <section className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 md:flex-row md:items-end md:justify-between"><div><div className="flex items-center gap-2 text-sm font-medium text-indigo-700"><BarChart3 className="h-4 w-4" /> Métricas</div><h1 className="mt-2 text-2xl font-semibold text-slate-900">Cobertura</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cobertura dos registros.</p></div><div className="flex items-center gap-2"><select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={60}>Últimos 60 dias</option><option value={90}>Últimos 90 dias</option></select><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button></div></section>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    {loading && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Carregando...</div>}
    {!loading && overview && <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><MetricCard label="Crianças ativas" value={overview.population.children} icon={Users} tone="border-indigo-200 bg-indigo-50 text-indigo-900" /><MetricCard label="Turmas ativas" value={overview.population.classrooms} icon={CalendarDays} tone="border-sky-200 bg-sky-50 text-sky-900" /><MetricCard label="Registros de diário" value={overview.activity.diaryEvents} icon={Activity} tone="border-emerald-200 bg-emerald-50 text-emerald-900" /><MetricCard label="Observações" value={overview.activity.observations} icon={BarChart3} tone="border-violet-200 bg-violet-50 text-violet-900" /><MetricCard label="Alertas ativos" value={overview.care.activeAlerts} icon={AlertTriangle} tone="border-amber-200 bg-amber-50 text-amber-900" /></div>
      <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-900">Cobertura de coleta</h2><p className="text-xs text-slate-500">Percentuais do período.</p></div></div><div className="space-y-5"><CoverageBar label="Crianças com observação" value={overview.coverage.childrenWithObservation} description={`${overview.activity.observations} observações no período`} /><CoverageBar label="Crianças com vínculo familiar" value={overview.coverage.childrenWithFamilyLink} description={`${overview.care.activeGuardians} vínculos ativos`} /><CoverageBar label="Desenvolvimento consentido" value={overview.coverage.childrenWithDevelopmentConsent} description={`${overview.care.developmentConsents} consentimentos específicos`} /><CoverageBar label="Crianças com alerta" value={overview.coverage.childrenWithActiveAlert} description={`${overview.care.activeAlerts} alertas ativos`} /></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-2"><HeartPulse className="h-5 w-5 text-emerald-600" /><div><h2 className="font-semibold text-slate-900">Integração do ecossistema</h2><p className="text-xs text-slate-500">Pedagogia, cuidado e família.</p></div></div><dl className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Diários publicados/revisados</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{overview.activity.publishedDiaryEvents}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Relatórios publicados</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{overview.activity.publishedReports}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mensagens família-escola</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{overview.activity.familyMessages}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Restrições alimentares ativas</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{overview.care.childrenWithDietaryRestriction}</dd></div></dl></section></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-900">Série diária</h2><p className="text-xs text-slate-500">Diários e acessos.</p></div></div><span className="text-xs text-slate-500">Escopo: {overview.scope}</span></div>{overview.daily.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Ainda não há métricas diárias para o período.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Diários</th><th className="px-3 py-2">Acessos</th></tr></thead><tbody>{overview.daily.map((item) => <tr key={item.date} className="border-b border-slate-100"><td className="px-3 py-2 text-slate-700">{item.date}</td><td className="px-3 py-2 text-slate-700">{item.diary}</td><td className="px-3 py-2 text-slate-700">{item.access}</td></tr>)}</tbody></table></div>}</section>
      <footer className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-600" /> Atualizado em {formatDate(overview.governance.generatedAt)} · somente leitura · acesso protegido</footer>
    </>}
  </div></PageShell>;
}
