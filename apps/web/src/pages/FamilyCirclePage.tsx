/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LoadingState } from '../components/ui/LoadingState';
import { getFamilyChildren, getFamilyCircle, sendFamilyMessage, type FamilyCircleResponse } from '../api/onda1';

export default function FamilyCirclePage() {
  const childId = new URLSearchParams(window.location.search).get('childId') ?? undefined;
  const [data, setData] = useState<FamilyCircleResponse | null>(null);
  const [selectedChildId, setSelectedChildId] = useState(childId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      let resolvedChildId = childId;
      if (!resolvedChildId) {
        const children = await getFamilyChildren();
        resolvedChildId = children[0]?.id;
        setSelectedChildId(resolvedChildId);
      }
      if (!resolvedChildId) { setError('Nenhuma criança vinculada disponível.'); return; }
      setData(await getFamilyCircle(resolvedChildId, { limit: 30 }));
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Family Circle ainda não está disponível para este tenant.'); } finally { setLoading(false); }
  }

  useEffect(() => { load();   }, [childId]);


  async function send() {
    const conversation = data?.conversations?.[0];
    if (!conversation || !body.trim()) return;
    setSending(true);
    try { await sendFamilyMessage(conversation.id, body.trim(), `web-${Date.now()}`); setBody(''); await load(); } catch (err: any) { setError(err?.response?.data?.message ?? 'Não foi possível enviar a mensagem.'); } finally { setSending(false); }
  }

  return <PageShell title="Family Circle" subtitle={data?.child ? `${data.child.firstName ?? ''} ${data.child.lastName ?? ''}` : selectedChildId ? 'Comunicação autorizada' : 'Crianças vinculadas'} headerActions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" /> Atualizar</Button>}>
    {loading ? <LoadingState /> : error ? <Card><CardContent className="p-6"><p className="text-sm font-medium text-[var(--text-primary)]">Acesso protegido</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{error}</p></CardContent></Card> : data ? <div className="space-y-4"><div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"><ShieldCheck className="h-5 w-5 text-[var(--accent-cyan)]" /><div><p className="text-sm font-medium text-[var(--text-primary)]">Feed privado e consentido</p><p className="text-xs text-[var(--text-secondary)]">Somente registros publicados para o público autorizado aparecem aqui.</p></div></div><Card><CardContent className="p-4"><div className="mb-3 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[var(--accent-violet)]" /><p className="text-sm font-medium text-[var(--text-primary)]">Publicações</p></div>{data.publications.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Nenhuma publicação disponível.</p> : <div className="space-y-3">{data.publications.map((publication: any) => <div key={publication.id} className="rounded-lg border border-[var(--border-subtle)] p-3"><p className="text-xs text-[var(--text-secondary)]">{publication.sourceType} · {publication.publishedAt ? new Date(publication.publishedAt).toLocaleDateString('pt-BR') : '—'}</p><p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{typeof publication.snapshot === 'string' ? publication.snapshot : publication.snapshot?.text ?? publication.snapshot?.content ?? 'Registro publicado.'}</p></div>)}</div>}</CardContent></Card><Card><CardContent className="p-4"><p className="mb-3 text-sm font-medium text-[var(--text-primary)]">Conversas</p>{data.conversations.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Nenhuma conversa aberta.</p> : <div className="space-y-3">{data.conversations.map((conversation: any) => <div key={conversation.id} className="rounded-lg border border-[var(--border-subtle)] p-3"><p className="text-sm text-[var(--text-primary)]">{conversation.subject}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{conversation.messages?.[0]?.body ?? 'Sem mensagens ainda.'}</p></div>)}</div>}<div className="mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-page)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escreva uma mensagem" disabled={!data.conversations?.[0]} /><Button size="sm" onClick={send} disabled={sending || !data.conversations?.[0] || !body.trim()}><Send className="mr-1 h-4 w-4" /> Enviar</Button></div></CardContent></Card></div> : null}
  </PageShell>;
}
