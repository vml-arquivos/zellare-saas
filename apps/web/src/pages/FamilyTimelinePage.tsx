import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, HeartHandshake, LockKeyhole, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import {
  getFamilyTimeline,
  listFamilyChildren,
  listFamilyMessages,
  markFamilyMessageRead,
  sendFamilyMessage,
  type FamilyChild,
  type FamilyMessage,
  type FamilyTimelineResponse,
} from '../api/family';

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
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [readingMessageId, setReadingMessageId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadChildContext(childId: string) {
    const [nextTimeline, nextMessages] = await Promise.all([
      getFamilyTimeline(childId),
      listFamilyMessages(childId),
    ]);
    setTimeline(nextTimeline);
    setMessages(nextMessages);
  }

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listFamilyChildren();
      setChildren(result.items);
      const childId = selectedChildId && result.items.some((child) => child.id === selectedChildId) ? selectedChildId : '';
      setSelectedChildId(childId);
      if (childId) await loadChildContext(childId);
      else {
        setTimeline(null);
        setMessages([]);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => { void loadChildren(); }, [loadChildren]);

  async function selectChild(childId: string) {
    setSelectedChildId(childId);
    setError(null);
    setNotice(null);
    try {
      await loadChildContext(childId);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }

  async function refreshContext() {
    if (!selectedChildId) return;
    try {
      await loadChildContext(selectedChildId);
      setNotice('Timeline e mensagens atualizadas.');
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
      await sendFamilyMessage(selectedChildId, { subject: subject.trim(), body: body.trim() });
      setSubject('');
      setBody('');
      setNotice('Mensagem enviada para a equipe da escola.');
      await refreshContext();
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  async function readMessage(message: FamilyMessage) {
    if (message.status !== 'ENVIADA') return;
    setReadingMessageId(message.id);
    setError(null);
    try {
      await markFamilyMessageRead(message.id);
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, status: 'LIDA' } : item));
    } catch (readError) {
      setError(errorMessage(readError));
    } finally {
      setReadingMessageId('');
    }
  }

  return (
    <PageShell title="Timeline da criança" subtitle="Acompanhamento privado, contextualizado e protegido para escola e família.">
      <div className="space-y-6">
        {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <HeartHandshake className="h-5 w-5 text-indigo-600" />
          <div className="mr-auto"><p className="font-semibold">Crianças vinculadas</p><p className="text-xs text-slate-500">Somente vínculos ativos aparecem neste espaço.</p></div>
          {children.map((child) => <button key={child.id} type="button" onClick={() => void selectChild(child.id)} className={`rounded-xl px-3 py-2 text-sm ${child.id === selectedChildId ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700'}`}>{child.firstName} {child.lastName}</button>)}
          <button type="button" onClick={() => void refreshContext()} disabled={loading || !selectedChildId} className="rounded-lg border border-slate-300 p-2 text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </section>

        {!timeline && !loading && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Nenhuma criança vinculada ou disponível no escopo atual.</div>}

        {timeline && <>
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-semibold text-emerald-950">Privacidade aplicada</p>
                <p className="mt-1 text-sm text-emerald-900">Acesso autorizado. Saúde protegida.</p>
                <p className="mt-1 text-xs text-emerald-800">Período: {formatDate(timeline.from)} até {formatDate(timeline.to)}</p>
                <p className="mt-1 text-xs font-medium text-emerald-800">
                  {timeline.privacy.developmentVisible === false
                    ? 'Registros detalhados de desenvolvimento estão ocultos porque o consentimento correspondente não está ativo.'
                    : 'Registros de desenvolvimento liberados pelo consentimento ativo do vínculo.'}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="space-y-4">
              {timeline.items.map((item) => <article key={`${item.kind}-${item.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{item.kind.replace('_', ' ')}</span><time className="text-xs text-slate-500">{formatDate(item.date)}</time></div><h2 className="mt-3 font-semibold text-slate-900">{item.title}</h2>{item.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.body}</p>}</article>)}
              {!timeline.items.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Nenhum evento publicado no período.</div>}

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-indigo-600" /><h2 className="font-semibold">Mensagens protegidas</h2></div>
                <p className="mt-1 text-xs text-slate-500">Somente os participantes autorizados desta criança podem ver esta conversa.</p>
                <div className="mt-4 space-y-3">
                  {messages.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Ainda não há mensagens neste vínculo.</p>}
                  {messages.map((message) => <article key={message.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{message.subject}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{message.body}</p><time className="mt-2 block text-[11px] text-slate-400">{formatDate(message.createdAt)}</time></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${message.status === 'LIDA' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>{message.status === 'LIDA' ? 'Lida' : 'Enviada'}</span></div>{message.status === 'ENVIADA' && <button type="button" disabled={readingMessageId === message.id} onClick={() => void readMessage(message)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 disabled:opacity-50"><CheckCheck className="h-3.5 w-3.5" />{readingMessageId === message.id ? 'Atualizando...' : 'Marcar como lida'}</button>}</article>)}
                </div>
              </section>
            </section>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-indigo-600" /><h2 className="font-semibold">Falar com a escola</h2></div><form onSubmit={submitMessage} className="mt-4 space-y-3"><label className="block text-xs font-medium text-slate-600">Assunto<input required value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-slate-600">Mensagem<textarea required rows={6} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />{sending ? 'Enviando...' : 'Enviar mensagem'}</button></form></aside>
          </div>
        </>}
      </div>
    </PageShell>
  );
}
