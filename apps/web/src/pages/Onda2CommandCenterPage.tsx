import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ClipboardList, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { isAxiosError } from 'axios';
import { useAuth } from '../app/AuthProvider';
import { getPerfilLabel } from '../api/auth';
import { getOnda2AccessibleUnits, getOnda2CommandCenter, getOnda2FacilitiesSummary } from '../api/onda2';
import type { Onda2CommandCenter, Onda2FacilitiesSummary, Onda2UnitRow } from '../api/onda2';

const EMPTY_TOTALS = {
  eventsToday: 0,
  openSessions: 0,
  activeBreaches: 0,
  openRequests: 0,
  openWorkOrders: 0,
  overdueWorkOrders: 0,
};

function metricLabel(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function shortTime(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function StatCard({ label, value, icon: Icon, tone = 'brand' }: { label: string; value: number; icon: typeof Building2; tone?: 'brand' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'ds-badge-green' : tone === 'warning' ? 'ds-badge-amber' : tone === 'danger' ? 'ds-badge-red' : 'ds-badge-blue';
  return (
    <article className="ds-kpi flex min-h-[7rem] flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <span className={`ds-icon-tile ${toneClass}`} aria-hidden="true"><Icon className="h-4 w-4" /></span>
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Onda 2</span>
      </div>
      <div>
        <div className="ds-kpi-value">{metricLabel(value)}</div>
        <div className="ds-kpi-label">{label}</div>
      </div>
    </article>
  );
}

function UnitRow({ row }: { row: Onda2UnitRow }) {
  const issueCount = row.activeBreaches + row.openRequests + row.overdueWorkOrders;
  return (
    <div className="grid gap-3 border-b border-[var(--border-subtle)] py-4 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(5rem,0.7fr))] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-[var(--text-brand)]" />
          <span className="truncate text-sm text-[var(--text-primary)]">{row.unit.name}</span>
        </div>
        <div className="mt-1 pl-6 text-xs text-[var(--text-tertiary)]">{row.unit.code || row.unit.id}</div>
      </div>
      <MetricCell label="Eventos" value={row.eventsToday} />
      <MetricCell label="Sessões" value={row.openSessions} />
      <MetricCell label="Breaches" value={row.activeBreaches} danger={row.activeBreaches > 0} />
      <MetricCell label="Pedidos" value={row.openRequests} />
      <MetricCell label="OS vencidas" value={row.overdueWorkOrders} danger={row.overdueWorkOrders > 0} />
      <div className="md:col-span-6 md:hidden">
        <span className={`ds-badge ${issueCount > 0 ? 'ds-badge-amber' : 'ds-badge-green'}`}>
          {issueCount > 0 ? `${issueCount} ponto(s) para revisar` : 'Sem pendências críticas'}
        </span>
      </div>
    </div>
  );
}

function MetricCell({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 md:block">
      <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
      <strong className={`text-sm font-normal ${danger ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>{metricLabel(value)}</strong>
    </div>
  );
}

export default function Onda2CommandCenterPage() {
  const { user } = useAuth();
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [commandCenter, setCommandCenter] = useState<Onda2CommandCenter | null>(null);
  const [facilities, setFacilities] = useState<Onda2FacilitiesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [pulse, serviceDesk] = await Promise.all([
        getOnda2CommandCenter(unitId || undefined),
        getOnda2FacilitiesSummary(unitId || undefined),
      ]);
      setCommandCenter(pulse);
      setFacilities(serviceDesk);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 403) {
        setError('Onda 2 está em rollout controlado. Este tenant ainda não tem o Command Center habilitado.');
      } else if (isAxiosError(cause) && cause.response?.status === 401) {
        setError('Sua sessão expirou. Entre novamente para continuar.');
      } else {
        setError('Não foi possível atualizar os dados operacionais agora. Tente novamente.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unitId]);

  useEffect(() => {
    let active = true;
    getOnda2AccessibleUnits()
      .then((accessible) => {
        if (!active) return;
        const fallback = user?.unit ? [{ id: user.unit.id, name: user.unit.name, code: user.unit.unitCode }] : [];
        const merged = accessible.length > 0 ? accessible : fallback;
        setUnits(merged);
        if (user?.unitId && merged.some((item) => item.id === user.unitId)) setUnitId(user.unitId);
      })
      .catch(() => {
        if (active && user?.unit) {
          setUnits([{ id: user.unit.id, name: user.unit.name, code: user.unit.unitCode }]);
        }
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const totals = commandCenter?.totals ?? EMPTY_TOTALS;
  const rows = commandCenter?.units ?? [];
  const selectedLabel = useMemo(() => unitId ? units.find((item) => item.id === unitId)?.name ?? 'Unidade selecionada' : 'Todas as unidades acessíveis', [unitId, units]);

  return (
    <main className="mx-auto w-full max-w-[var(--content-max-w)] px-4 py-5 sm:px-6 lg:px-8">
      <header className="zelare-page-header mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Pulse + Facilities</p>
          <h1 className="zelare-page-title text-2xl text-[var(--text-primary)] sm:text-3xl">Command Center</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Visão operacional de {selectedLabel.toLowerCase()}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="onda2-unit">Unidade</label>
          <select id="onda2-unit" className="ds-input min-w-[13rem] sm:w-auto" value={unitId} onChange={(event) => setUnitId(event.target.value)}>
            <option value="">Todas as unidades acessíveis</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          <button type="button" className="ds-btn ds-btn-secondary mobile-touch-target" onClick={() => void load(true)} disabled={loading || refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Indicadores operacionais">
        <StatCard label="Eventos hoje" value={totals.eventsToday} icon={ClipboardList} />
        <StatCard label="Sessões abertas" value={totals.openSessions} icon={CheckCircle2} tone="success" />
        <StatCard label="Breaches ativos" value={totals.activeBreaches} icon={AlertTriangle} tone={totals.activeBreaches > 0 ? 'danger' : 'success'} />
        <StatCard label="Pedidos abertos" value={totals.openRequests} icon={Wrench} tone="warning" />
        <StatCard label="OS vencidas" value={totals.overdueWorkOrders} icon={AlertTriangle} tone={totals.overdueWorkOrders > 0 ? 'danger' : 'success'} />
      </section>

      {error && (
        <div className="ds-alert ds-alert-warning mb-6" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong className="font-normal">Acesso controlado</strong><p className="mt-1 text-xs opacity-90">{error}</p></div>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <article className="ds-card p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><h2 className="text-base text-[var(--text-primary)]">Saúde por unidade</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Dados aceitos no ciclo operacional atual.</p></div>
            <span className="ds-badge ds-badge-neutral">{commandCenter ? `Atualizado ${shortTime(commandCenter.generatedAt)}` : 'Aguardando'}</span>
          </div>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(5rem,0.7fr))] gap-3 border-b border-[var(--border-default)] pb-2 pt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] md:grid">
            <span>Unidade</span><span>Eventos</span><span>Sessões</span><span>Breaches</span><span>Pedidos</span><span>OS vencidas</span>
          </div>
          {loading ? <div className="space-y-3 py-5"><div className="ds-loading h-10 w-full" /><div className="ds-loading h-10 w-full" /><div className="ds-loading h-10 w-full" /></div> : rows.length > 0 ? rows.map((row) => <UnitRow key={row.unit.id} row={row} />) : <div className="py-10 text-center text-sm text-[var(--text-secondary)]">Nenhum dado operacional disponível no escopo selecionado.</div>}
        </article>

        <aside className="space-y-6">
          <article className="ds-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3"><span className="ds-icon-tile ds-badge-blue"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-base text-[var(--text-primary)]">Governança</h2><p className="text-xs text-[var(--text-secondary)]">Proteções ativas.</p></div></div>
            <div className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-[var(--text-secondary)]">Inferência diagnóstica</span><span className="ds-badge ds-badge-green">Desligada</span></div><div className="flex items-center justify-between gap-3"><span className="text-[var(--text-secondary)]">Revisão humana</span><span className="ds-badge ds-badge-green">Obrigatória</span></div></div>
          </article>
          <article className="ds-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base text-[var(--text-primary)]">Facilities</h2><p className="text-xs text-[var(--text-secondary)]">Service Desk real.</p></div><Wrench className="h-4 w-4 text-[var(--text-brand)]" /></div>
            {loading ? <div className="ds-loading h-24 w-full" /> : <div className="grid grid-cols-2 gap-3"><MiniValue label="Espaços" value={facilities?.spaces ?? 0} /><MiniValue label="Ativos" value={facilities?.assets ?? 0} /><MiniValue label="Pedidos" value={facilities?.openRequests ?? 0} /><MiniValue label="Ordens abertas" value={facilities?.openWorkOrders ?? 0} /></div>}
          </article>
        </aside>
      </section>

      <footer className="mt-6 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
        <span>{getPerfilLabel(user)} · escopo protegido por unidade e mantenedora</span>
        <span>Dados reais · sem diagnóstico automático</span>
      </footer>
    </main>
  );
}

function MiniValue({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3"><div className="text-lg text-[var(--text-primary)]">{metricLabel(value)}</div><div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{label}</div></div>;
}
