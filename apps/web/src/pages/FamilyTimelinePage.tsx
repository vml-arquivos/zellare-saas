import { useEffect, useState } from 'react';
import { HeartHandshake, LockKeyhole, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { getFamilyTimeline, listFamilyChildren, sendFamilyMessage, type FamilyChild, type FamilyTimelineResponse } from '../api/family';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function errorMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || (error instanceof Error ? error.message : 'Não foi possível carregar a timeline.');
}

export default function FamilyTimelinePage() {
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [timeline, setTimeline] = useState<FamilyTimelineResponse | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadChildren() {
    setLoading(true);
    setError(null);
    try {
      const result = await listFamilyChildren();
      setChildren(result);
      const childId = selectedChildId || result[0]?.id || '';
      setSelectedChildId(childId);
      if (childId) setTimeline(await getFamilyTimeline(childId));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadChildren(); }, []);

  async function selectChild(childId: string) {
    setSelectedChildId(childId);
    setError(null);
    try {
      setTimeline(await getFamilyTimeline(childId));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }

  async function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedChildId || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await sendFamilyMessage(selectedChildId, { subject, body });
      setSubject('');
      setBody('');
      setNotice('Mensagem enviada para a equipe da escola.');
      setTimeline(await getFamilyTimeline(selectedChildId));
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell title="Timeline da criança" subtitle="Acompanhamento privado, contextualizado e protegido para escola e família.">
      <div className="space-y-6">
        {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><HeartHandshake className="h-5 w-5 text-indigo-600" /><div className="mr-auto"><p className="font-semibold">Crianças vinculadas</p><p className="text-xs text-slate-500">Somente vínculos ativos aparecem neste espaço.</p></div>{children.map((child) => <button key={child.id} type="button" onClick={() => void selectChild(child.id)} className={`rounded-xl px-3 py-2 text-sm ${child.id === selectedChildId ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700'}`}>{child.firstName} {child.lastName}</button>)}<button type="button" onClick={() => void loadChildren()} disabled={loading} className="rounded-lg border border-slate-300 p-2 text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></section>
        {timeline && <><section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-emerald-700" /><div><p className="font-semibold text-emerald-950">Privacidade aplicada</p><p className="mt-1 text-sm text-emerald-900">A timeline filtra dados para o vínculo autorizado. Dados de saúde não são exibidos nesta visão.</p><p className="mt-1 text-xs text-emerald-800">Período: {formatDate(timeline.from)} até {formatDate(timeline.to)}</p></div></div></section><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><section className="space-y-4">{timeline.items.map((item) => <article key={`${item.kind}-${item.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{item.kind.replace('_', ' ')}</span><time className="text-xs text-slate-500">{formatDate(item.date)}</time></div><h2 className="mt-3 font-semibold text-slate-900">{item.title}</h2>{item.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.body}</p>}</article>)}{!timeline.items.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Nenhum evento publicado no período.</div>}</section><aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-indigo-600" /><h2 className="font-semibold">Falar com a escola</h2></div><form onSubmit={submitMessage} className="mt-4 space-y-3"><label className="block text-xs font-medium text-slate-600">Assunto<input required value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-slate-600">Mensagem<textarea required rows={6} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />Enviar mensagem</button></form></aside></div></>}
      </div>
    </PageShell>
  );
}
