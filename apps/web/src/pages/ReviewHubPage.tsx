/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Check, Clock3, RefreshCw, RotateCcw } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LoadingState } from '../components/ui/LoadingState';
import { getReviewQueue, updateReviewTask } from '../api/onda1';

export default function ReviewHubPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { const data = await getReviewQueue({ limit: 50 }); setItems(data.items ?? []); } catch (err: any) { setError(err?.response?.data?.message ?? 'Review Hub ainda não está disponível para este tenant.'); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function decide(item: any, status: 'APPROVED' | 'REJECTED') {
    setSaving(item.id);
    try { const updated = await updateReviewTask(item.id, { status, expectedVersion: item.version }); setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry)); } catch (err: any) { setError(err?.response?.data?.message ?? 'Não foi possível salvar a decisão.'); } finally { setSaving(''); }
  }

  return <PageShell title="Review Hub" subtitle="Fila de revisão humana" headerActions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" /> Atualizar</Button>}>
    {loading ? <LoadingState /> : error ? <Card><CardContent className="p-6"><p className="text-sm font-medium text-[var(--text-primary)]">Recurso em rollout controlado</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{error}</p></CardContent></Card> : <div className="space-y-3">{items.length === 0 ? <Card><CardContent className="p-6 text-sm text-[var(--text-secondary)]">Nenhuma revisão pendente.</CardContent></Card> : items.map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-[var(--text-primary)]">{item.child?.firstName} {item.child?.lastName}</p><span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{item.priority}</span><span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{item.status}</span></div><p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{item.requestNote ?? item.evidence?.summary ?? item.evidence?.content ?? 'Evidência aguardando revisão.'}</p><p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-secondary)]"><Clock3 className="h-3.5 w-3.5" /> Versão {item.version}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={saving === item.id} onClick={() => decide(item, 'REJECTED')}><RotateCcw className="mr-1 h-4 w-4" /> Devolver</Button><Button size="sm" disabled={saving === item.id} onClick={() => decide(item, 'APPROVED')}><Check className="mr-1 h-4 w-4" /> Aprovar</Button></div></CardContent></Card>)}</div>}
  </PageShell>;
}
