/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Flag, ShieldCheck, Target } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LoadingState } from '../components/ui/LoadingState';
import { getChild360, type Child360Response } from '../api/onda1';

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function childName(child?: Child360Response['child']) {
  return [child?.firstName, child?.lastName].filter(Boolean).join(' ') || 'Criança';
}

export default function Child360Page() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Child360Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!childId) return;
    let active = true;
    setLoading(true);
    getChild360(childId).then((next) => active && setData(next)).catch((err) => active && setError(err?.response?.data?.message ?? 'Child 360 ainda não está disponível para este tenant.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [childId]);

  const coverage = useMemo(() => data?.quality?.coverageDays ?? 0, [data]);

  return (
    <PageShell title="Child 360" subtitle={data ? childName(data.child) : 'Desenvolvimento e evidências'} headerActions={<Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Button>}>
      {loading ? <LoadingState /> : error ? (
        <Card><CardContent className="p-6 text-sm text-[var(--text-secondary)]"><p className="font-medium text-[var(--text-primary)]">Recurso em rollout controlado</p><p className="mt-1">{error}</p></CardContent></Card>
      ) : data ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--accent-cyan)]" /><div><p className="text-sm font-medium text-[var(--text-primary)]">Leitura descritiva para apoio humano.</p><p className="text-xs text-[var(--text-secondary)]">Não constitui diagnóstico clínico. Todos os sinais exigem revisão humana.</p></div></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-[var(--text-secondary)]">Evidências</p><p className="mt-1 text-2xl font-medium text-[var(--text-primary)]">{data.evidence.total}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-[var(--text-secondary)]">Dias cobertos</p><p className="mt-1 text-2xl font-medium text-[var(--text-primary)]">{coverage}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-[var(--text-secondary)]">Objetivos ativos</p><p className="mt-1 text-2xl font-medium text-[var(--text-primary)]">{data.goals.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-[var(--text-secondary)]">Urgências</p><p className="mt-1 text-2xl font-medium text-[var(--text-primary)]">{data.operationalUrgency.length}</p></CardContent></Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card><CardContent className="p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-medium text-[var(--text-primary)]">Linha do tempo</p><p className="text-xs text-[var(--text-secondary)]">{formatDate(data.period.startDate)} a {formatDate(data.period.endDate)}</p></div><BookOpen className="h-5 w-5 text-[var(--accent-violet)]" /></div><div className="space-y-3">{data.timeline.items.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Nenhuma evidência no período.</p> : data.timeline.items.map((item: any) => <div key={item.id} className="border-l-2 border-[var(--accent-violet)] pl-3"><div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><Clock3 className="h-3.5 w-3.5" />{formatDate(item.capturedAt ?? item.createdAt)}<span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5">{item.sourceType ?? 'Registro'}</span></div><p className="mt-1 text-sm text-[var(--text-primary)]">{item.summary ?? item.content ?? item.evidenceType ?? 'Evidência registrada'}</p></div>)}</div></CardContent></Card>
            <div className="space-y-4"><Card><CardContent className="p-4"><div className="mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-[var(--accent-cyan)]" /><p className="text-sm font-medium text-[var(--text-primary)]">Objetivos</p></div>{data.goals.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Nenhum objetivo registrado.</p> : data.goals.slice(0, 5).map((goal: any) => <div key={goal.id} className="border-b border-[var(--border-subtle)] py-2 last:border-0"><p className="text-sm text-[var(--text-primary)]">{goal.title}</p><p className="text-xs text-[var(--text-secondary)]">{goal.status}</p></div>)}</CardContent></Card><Card><CardContent className="p-4"><div className="mb-3 flex items-center gap-2"><Flag className="h-4 w-4 text-[var(--accent-cyan)]" /><p className="text-sm font-medium text-[var(--text-primary)]">Urgência operacional</p></div>{data.operationalUrgency.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Nenhuma urgência aberta.</p> : data.operationalUrgency.slice(0, 5).map((alert: any) => <div key={alert.id} className="border-b border-[var(--border-subtle)] py-2 last:border-0"><p className="text-sm text-[var(--text-primary)]">{alert.title}</p><p className="text-xs text-[var(--text-secondary)]">{alert.severity}</p></div>)}</CardContent></Card></div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><CheckCircle2 className="h-4 w-4 text-[var(--accent-cyan)]" /> Fonte rastreável · inferência diagnóstica desativada · revisão humana obrigatória</div>
        </div>
      ) : null}
    </PageShell>
  );
}
