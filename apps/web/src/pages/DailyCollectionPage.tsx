import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  WifiOff,
} from 'lucide-react';
import { QuickMicrogestoPanel } from '../components/diary/QuickMicrogestoPanel';
import {
  flushOfflineQueue,
  getDiaryEvents,
  getDiaryQuality,
  registerStructuredDailyObservation,
  type DiaryQuality,
} from '../api/diary.api';
import http from '../api/http';
import { useApiCache } from '../hooks/useApiCache';

type Child = {
  id: string;
  firstName: string;
  lastName: string;
};

type Classroom = {
  id: string;
  name: string;
};

type DailyEventSummary = {
  id: string;
  childId: string;
  childName: string;
  title: string;
  eventDate: string;
  optimistic?: boolean;
};

function normalizeList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const value = payload as Record<string, unknown>;
  for (const key of ['children', 'classrooms', 'data', 'items']) {
    if (Array.isArray(value[key])) return value[key] as any[];
  }
  return [];
}

function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function DailyCollectionPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomId, setClassroomId] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [eventDate, setEventDate] = useState(todayInputValue);
  const [events, setEvents] = useState<DailyEventSummary[]>([]);
  const [quality, setQuality] = useState<DiaryQuality | null>(null);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [offlineCount, setOfflineCount] = useState(0);
  const apiCache = useApiCache(10_000);

  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === classroomId),
    [classrooms, classroomId],
  );

  const childNames = useMemo(
    () => new Map(children.map((child) => [child.id, `${child.firstName} ${child.lastName}`])),
    [children],
  );

  async function loadClassrooms() {
    try {
      setLoadingClassrooms(true);
      const response = await http.get('/lookup/classrooms/accessible');
      const normalized = normalizeList(response.data)
        .filter((item) => item?.id && item?.name)
        .map((item) => ({ id: String(item.id), name: String(item.name) }));
      setClassrooms(normalized);
      setClassroomId((current) => current || normalized[0]?.id || '');
    } catch {
      setClassrooms([]);
      setClassroomId('');
      setMessage('Não foi possível carregar as turmas autorizadas. Tente atualizar novamente.');
    } finally {
      setLoadingClassrooms(false);
    }
  }

  async function loadChildren() {
    if (!classroomId) {
      setChildren([]);
      return;
    }
    try {
      setLoadingChildren(true);
      const response = await http.get(`/lookup/classrooms/${classroomId}/children`);
      const normalized = normalizeList(response.data)
        .filter((item) => item?.id && item?.firstName && item?.lastName)
        .map((item) => ({
          id: String(item.id),
          firstName: String(item.firstName),
          lastName: String(item.lastName),
        }));
      setChildren(normalized);
    } catch {
      setChildren([]);
      setMessage('Não foi possível carregar as crianças da turma selecionada.');
    } finally {
      setLoadingChildren(false);
    }
  }

  async function loadEvents() {
    if (!classroomId || !eventDate) {
      setEvents([]);
      return;
    }
    try {
      setLoadingEvents(true);
      const params = {
        classroomId,
        startDate: `${eventDate}T00:00:00.000Z`,
        endDate: `${eventDate}T23:59:59.999Z`,
      };
      const response = await apiCache.get('/diary-events', params, () => getDiaryEvents(params));
      const normalized = response.map((event) => ({
        id: event.id,
        childId: event.childId,
        childName:
          event.child && typeof event.child === 'object'
            ? `${String((event.child as any).firstName ?? '')} ${String((event.child as any).lastName ?? '')}`.trim()
            : childNames.get(event.childId) ?? 'Criança da turma',
        title: event.title,
        eventDate: event.eventDate,
        optimistic: Boolean(event._optimistic),
      }));
      setEvents(normalized);
    } catch {
      setEvents([]);
      setMessage('Os registros foram salvos, mas a leitura do dia não pôde ser atualizada.');
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    void loadClassrooms();
  }, []);

  useEffect(() => {
    void loadChildren();
  }, [classroomId]);

  async function loadQuality() {
    if (!classroomId || !eventDate) {
      setQuality(null);
      return;
    }
    try {
      const params = {
        classroomId,
        startDate: `${eventDate}T00:00:00.000Z`,
        endDate: `${eventDate}T23:59:59.999Z`,
      };
      const response = await apiCache.get('/diary-events/quality', params, () => getDiaryQuality(params));
      setQuality(response);
    } catch {
      setQuality(null);
    }
  }

  useEffect(() => {
    void loadEvents();
    void loadQuality();
  }, [classroomId, eventDate, children.length]);

  useEffect(() => {
    const sync = async () => {
      const flushed = await flushOfflineQueue();
      setOfflineCount((current) => Math.max(0, current - flushed));
      if (flushed > 0) {
        setMessage(`${flushed} registro(s) offline foram sincronizados com o Zelare.`);
        await loadEvents();
      }
    };
    window.addEventListener('online', sync);
    void sync();
    return () => window.removeEventListener('online', sync);
  }, [classroomId, eventDate]);

  async function handleRegistrar(registro: {
    childIds: string[];
    categoria: string;
    microgestoId: string;
    nivel: string;
    descricao?: string;
    campoExperiencia?: string;
  }) {
    if (!classroomId || !eventDate) return;
    setSaving(true);
    setMessage('');
    let created = 0;
    let queued = 0;
    try {
      for (const childId of registro.childIds) {
        const result = await registerStructuredDailyObservation({
          ...registro,
          childId,
          classroomId,
          eventDate,
        });
        created += 1;
        if (result._optimistic) queued += 1;
      }
      setOfflineCount((current) => current + queued);
      setMessage(
        queued > 0
          ? `${created} registro(s) ficaram na fila offline e serão sincronizados automaticamente.`
          : `${created} registro(s) estruturado(s) salvo(s) com sucesso.`
      );
      apiCache.invalidateAll();
      await loadEvents();
    } catch {
      setMessage(
        created > 0
          ? `${created} registro(s) foram salvos. A operação parou ao encontrar uma falha no restante.`
          : 'Não foi possível salvar o registro. Verifique a data, a turma e a conexão.'
      );
      await loadEvents();
    } finally {
      setSaving(false);
    }
  }

  if (loadingClassrooms) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando turmas autorizadas...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-700 to-brand-700 p-6 text-white shadow-ds-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-100">
              <ClipboardCheck className="h-5 w-5" /> Coleta diária estruturada
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Registrar o desenvolvimento em poucos segundos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">
              Use o catálogo pedagógico real para registrar uma habilidade, nível observado e contexto. Cada ação cria um evento auditável no diário da turma e pode ser sincronizada quando a conexão retornar.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-indigo-50">
            <ShieldCheck className="h-4 w-4" /> Escopo da turma e revisão humana
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block flex-1 text-sm font-medium text-slate-700">
              Turma autorizada
              <select
                value={classroomId}
                onChange={(event) => setClassroomId(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Selecione uma turma</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Data pedagógica
              <span className="relative mt-1.5 flex items-center">
                <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={eventDate}
                  max={todayInputValue()}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </span>
            </label>
            <button
              type="button"
              onClick={() => { void loadClassrooms(); void loadChildren(); void loadEvents(); void loadQuality(); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>

          {!classroomId ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Selecione uma turma para iniciar a coleta com crianças do escopo real.
            </div>
          ) : loadingChildren ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando crianças da turma...
            </div>
          ) : children.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center text-sm text-amber-800">
              Nenhuma criança está disponível no escopo desta turma. O Zelare não cria registros simulados; confirme as matrículas e vínculos reais.
            </div>
          ) : (
            <QuickMicrogestoPanel
              criancas={children}
              classroomId={classroomId}
              data={eventDate}
              onRegistrar={handleRegistrar}
            />
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <UsersRound className="h-4 w-4 text-indigo-600" /> Contexto real
            </div>
            <p className="text-sm text-slate-500">{selectedClassroom?.name ?? 'Nenhuma turma selecionada'}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-indigo-50 p-3">
                <p className="text-2xl font-bold text-indigo-700">{children.length}</p>
                <p className="text-xs text-indigo-700/70">crianças no escopo</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-2xl font-bold text-emerald-700">{events.length}</p>
                <p className="text-xs text-emerald-700/70">registros no dia</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ClipboardCheck className="h-4 w-4 text-indigo-600" /> Qualidade do preenchimento
            </div>
            {quality ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-indigo-50 p-2"><strong className="text-indigo-700">{quality.coverage.structuredPercent}%</strong><span className="block text-indigo-700/70">estruturados</span></div>
                <div className="rounded-lg bg-emerald-50 p-2"><strong className="text-emerald-700">{quality.coverage.documentationPercent}%</strong><span className="block text-emerald-700/70">documentados</span></div>
                <div className="rounded-lg bg-slate-50 p-2"><strong className="text-slate-700">{quality.totals.distinctChildren}</strong><span className="block text-slate-500">crianças alcançadas</span></div>
                <div className="rounded-lg bg-slate-50 p-2"><strong className="text-slate-700">{quality.totals.authored}</strong><span className="block text-slate-500">com autoria</span></div>
              </div>
            ) : (
              <p className="text-xs leading-5 text-slate-500">Sem dados agregados para esta turma e data ou sem permissão para a métrica.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {offlineCount > 0 ? <WifiOff className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                Sincronização
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${offlineCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {offlineCount > 0 ? `${offlineCount} pendente(s)` : 'Em dia'}
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              {offlineCount > 0
                ? 'Há registros aguardando conexão. Eles serão reenviados automaticamente quando o dispositivo voltar a ficar online.'
                : 'Os registros são enviados ao backend real e permanecem auditáveis por autoria, turma e data.'}
            </p>
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Registros do dia</h2>
            <p className="text-xs text-slate-500">Leitura dos eventos reais retornados pelo diário da turma.</p>
          </div>
          {loadingEvents && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
        </div>
        {events.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Ainda não há registros estruturados para esta turma e data.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {events.slice(0, 12).map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{event.childName}</p>
                  <p className="truncate text-xs text-slate-500">{event.title}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${event.optimistic ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {event.optimistic ? 'Offline' : 'Salvo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {saving && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando registros reais...
        </div>
      )}
      {message && !saving && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl">
          {message}
        </div>
      )}
    </div>
  );
}
