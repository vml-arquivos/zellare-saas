import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Info, RefreshCw, Trophy } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { getTeacherRanking, type TeacherRankingResponse } from '../api/teacher-ranking';
import { useUnitScope } from '../contexts/UnitScopeContext';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function score(value: number) {
  return `${value.toFixed(1)} pts`;
}

export default function TeacherRankingPage() {
  const [data, setData] = useState<TeacherRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { accessibleUnits, selectedUnitId, setUnit } = useUnitScope();
  const [unitId, setUnitId] = useState(selectedUnitId ?? '');

  useEffect(() => {
    if (selectedUnitId && !unitId) setUnitId(selectedUnitId);
  }, [selectedUnitId, unitId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTeacherRanking({ from: from || undefined, to: to || undefined, unitId: unitId || undefined }));
    } catch (loadError) {
      const message = (loadError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || (loadError instanceof Error ? loadError.message : 'Não foi possível carregar o ranking.'));
    } finally {
      setLoading(false);
    }
  }, [from, to, unitId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <PageShell title="Ranking de preenchimento" subtitle="Indicador formativo, auditável e baseado nos registros reais do período selecionado.">
      <div className="space-y-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Unidade</label><select value={unitId} onChange={(event) => { const value = event.target.value; setUnitId(value); setUnit(value || null); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Todas as unidades do escopo</option>{accessibleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
            <div><label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">De</label><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Até</label><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Período padrão: 30 dias.</p>
        </section>
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 text-indigo-700" /><div><h2 className="font-semibold text-indigo-950">Como a pontuação é formada</h2><p className="mt-1 text-sm text-indigo-900">{data?.formula.total || '60% completude + 40% qualidade.'}</p><p className="mt-1 text-xs text-indigo-800">{data?.formula.note || 'Indicador de preenchimento.'}</p></div></div>
        </section>
        <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><BarChart3 className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-2xl font-semibold">{data?.rankings.length || 0}</p><p className="text-xs text-slate-500">Professores no escopo</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Trophy className="h-5 w-5 text-amber-600" /><p className="mt-3 text-2xl font-semibold">{data?.rankings[0] ? score(data.rankings[0].total) : '—'}</p><p className="text-xs text-slate-500">Maior pontuação</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar ranking</button><p className="mt-3 text-xs text-slate-500">Período: {data ? `${formatDate(data.from)} a ${formatDate(data.to)}` : 'carregando...'}</p></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Posição</th><th className="px-3 py-3">Professor</th><th className="px-3 py-3">Completude</th><th className="px-3 py-3">Qualidade</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Registros</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.rankings.map((row) => <tr key={row.teacherId} className={row.position === 1 ? 'bg-amber-50/50' : ''}><td className="px-3 py-3 font-semibold">#{row.position}</td><td className="px-3 py-3 font-medium">{row.teacherName}<span className="block text-xs font-normal text-slate-500">{row.classrooms} turma(s)</span></td><td className="px-3 py-3"><span className="font-semibold text-indigo-700">{score(row.completeness)}</span><span className="block text-xs text-slate-500">{row.metrics.conferences} conferências · {row.metrics.diaries} diários</span></td><td className="px-3 py-3"><span className="font-semibold text-emerald-700">{score(row.quality)}</span><span className="block text-xs text-slate-500">{row.metrics.conferencesFeitas} feitos · {row.metrics.diariesPublicados} publicados</span></td><td className="px-3 py-3 text-base font-bold">{score(row.total)}</td><td className="px-3 py-3 text-xs text-slate-600">{row.metrics.observations} observações<br />{row.metrics.observationsRicas} ricas</td></tr>)}{!loading && !data?.rankings.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-500">Nenhum professor com turma ativa no escopo atual.</td></tr>}</tbody></table></div></section>
      </div>
    </PageShell>
  );
}
