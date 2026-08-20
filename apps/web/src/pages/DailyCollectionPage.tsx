import { useEffect, useMemo, useRef, useState } from 'react';
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
  const childrenRequestRef = useRef(0);

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
      const nextClassroomId = classroomId || normalized[0]?.id || '';
      setClassrooms(normalized);
      setClassroomId(nextClassroomId);
      if (nextClassroomId && nextClassroomId !== classroomId) {
        await loadChildren(nextClassroomId);
      }
    } catch {
      setClassrooms([]);
      setClassroomId('');
      setMessage('Não foi possível carregar as turmas autorizadas. Tente atualizar novamente.');
    } finally {
      setLoadingClassrooms(false);
    }
  }

  async function loadChildren(targetClassroomId = classroomId) {
    const requestId = ++childrenRequestRef.current;
    if (!targetClassroomId) {
      setChildren([]);
      setLoadingChildren(false);
      return;
    }
    try {
      setLoadingChildren(true);
      let normalized: Child[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await http.get(`/lookup/classrooms/${targetClassroomId}/children`);
          normalized = normalizeList(response.data)
            .filter((item) => item?.id && item?.firstName && item?.lastName)
            .map((item) => ({
              id: String(item.id),
              firstName: String(item.firstName),
              lastName: String(item.lastName),
            }));
          if (normalized.length > 0 || attempt === 1) break;
        } catch (error) {
          if (attempt === 1) throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      if (requestId === childrenRequestRef.current) {
        setChildren(normalized);
      }
    } catch {
      if (requestId === childrenRequestRef.current) {
        setChildren([]);
        setMessage('Não foi possível carregar as crianças da turma selecionada.');
      }
    } finally {
      if (requestId === childrenRequestRef.current) {
        setLoadingChildren(false);
      }
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
    context?: string;
    opportunity?: string;
    support?: string;
    response?: string;
    teacherConcern?: boolean;
    abc?: {
      antecedent?: string;
      behavior: string;
      consequence?: string;
      intensity?: number;
      frequency?: number;
    };
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
      <header className="ds-card p-6 shadow-ds-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-normal text-[var(--text-brand-soft)]">
              <ClipboardCheck className="h-5 w-5" /> Coleta diária estruturada
            </div>
            <h1 className="text-2xl font-normal tracking-tight text-[var(--text-primary)]">Registrar o desenvolvimento em poucos segundos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Use o catálogo pedagógico real para registrar uma habilidade, nível observado e contexto. Cada ação cria um evento auditável no diário da turma e pode ser sincronizada quando a conexão retornar.
            </p>
          </div>
          <div className="ds-badge-brand flex items-center gap-2 px-3 py-2 text-xs">
            <ShieldCheck className="h-4 w-4" /> Escopo da turma e revisão humana
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="ds-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block flex-1 text-sm font-normal text-[var(--text-primary)]">
              Turma autorizada
              <select
                value={classroomId}
                onChange={(event) => setClassroomId(event.target.value)}
                className="ds-input mt-1.5 w-full px-3 py-2.5 text-sm outline-none transition"
              >
                <option value="">Selecione uma turma</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-normal text-[var(--text-primary)]">
              Data pedagógica
              <span className="relative mt-1.5 flex items-center">
                <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-tertiary)]" />
                <input
                  type="date"
                  value={eventDate}
                  max={todayInputValue()}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="ds-input py-2.5 pl-9 pr-3 text-sm outline-none transition"
                />
              </span>
            </label>
            <button
              type="button"
              onClick={() => { void loadClassrooms(); void loadChildren(classroomId); void loadEvents(); void loadQuality(); }}
              className="ds-btn-secondary inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm transition"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>

          {!classroomId ? (
            <div className="ds-surface rounded-xl border-dashed p-8 text-center text-sm text-[var(--text-tertiary)]">
              Selecione uma turma para iniciar a coleta com crianças do escopo real.
            </div>
          ) : loadingChildren ? (
            <div className="ds-surface flex items-center justify-center gap-2 rounded-xl p-8 text-sm text-[var(--text-tertiary)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando crianças da turma...
            </div>
          ) : children.length === 0 ? (
            <div className="ds-surface rounded-xl border-dashed p-8 text-center text-sm text-[var(--warning)]">
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
          <div className="ds-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-normal text-[var(--text-primary)]">
              <UsersRound className="h-4 w-4 text-[var(--text-brand-soft)]" /> Contexto real
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{selectedClassroom?.name ?? 'Nenhuma turma selecionada'}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="ds-surface p-3">
                <p className="text-2xl font-normal text-[var(--accent-violet)]">{children.length}</p>
                <p className="text-xs text-[var(--text-tertiary)]">crianças no escopo</p>
              </div>
              <div className="ds-surface p-3">
                <p className="text-2xl font-normal text-[var(--success)]">{events.length}</p>
                <p className="text-xs text-[var(--text-tertiary)]">registros no dia</p>
              </div>
            </div>
          </div>

          <div className="ds-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-normal text-[var(--text-primary)]">
              <ClipboardCheck className="h-4 w-4 text-[var(--text-brand-soft)]" /> Qualidade do preenchimento
            </div>
            {quality ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="ds-surface p-2"><strong className="text-[var(--accent-violet)]">{quality.coverage.structuredPercent}%</strong><span className="block text-[var(--text-tertiary)]">estruturados</span></div>
                <div className="ds-surface p-2"><strong className="text-[var(--success)]">{quality.coverage.documentationPercent}%</strong><span className="block text-[var(--text-tertiary)]">documentados</span></div>
                <div className="ds-surface p-2"><strong className="text-[var(--text-primary)]">{quality.totals.distinctChildren}</strong><span className="block text-[var(--text-tertiary)]">crianças alcançadas</span></div>
                <div className="ds-surface p-2"><strong className="text-[var(--text-primary)]">{quality.totals.authored}</strong><span className="block text-[var(--text-tertiary)]">com autoria</span></div>
              </div>
            ) : null}
            {quality?.collection ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="ds-surface p-2"><strong className="text-[var(--accent-violet)]">{quality.collection.events}</strong><span className="block text-[var(--text-tertiary)]">coletas versionadas</span></div>
                <div className="ds-surface p-2"><strong className="text-[var(--accent-cyan)]">{quality.collection.observedOpportunityPercent}%</strong><span className="block text-[var(--text-tertiary)]">com oportunidade</span></div>
                <div className="ds-surface p-2"><strong className="text-[var(--warning)]">{quality.collection.abc}</strong><span className="block text-[var(--text-tertiary)]">registros ABC</span></div>
                <div className="ds-surface p-2"><strong className="text-[var(--error)]">{quality.collection.teacherConcerns}</strong><span className="block text-[var(--text-tertiary)]">para revisão</span></div>
              </div>
            ) : null}
          </div>

          <div className="ds-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-normal text-[var(--text-primary)]">
                {offlineCount > 0 ? <WifiOff className="h-4 w-4 text-[var(--warning)]" /> : <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />}
                Sincronização
              </div>
              <span className={`ds-badge rounded-full px-2 py-1 text-[11px] ${offlineCount > 0 ? 'ds-badge-amber' : 'ds-badge-green'}`}>
                {offlineCount > 0 ? `${offlineCount} pendente(s)` : 'Em dia'}
              </span>
            </div>
            <p className="text-xs leading-5 text-[var(--text-secondary)]">
              {offlineCount > 0
                ? 'Há registros aguardando conexão. Eles serão reenviados automaticamente quando o dispositivo voltar a ficar online.'
                : 'Os registros são enviados ao backend real e permanecem auditáveis por autoria, turma e data.'}
            </p>
          </div>
        </aside>
      </section>

      <section className="ds-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-normal text-[var(--text-primary)]">Registros do dia</h2>
            <p className="text-xs text-[var(--text-secondary)]">Leitura dos eventos reais retornados pelo diário da turma.</p>
          </div>
          {loadingEvents && <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-violet)]" />}
        </div>
        {events.length === 0 ? (
          <p className="ds-surface rounded-xl p-5 text-sm text-[var(--text-tertiary)]">Ainda não há registros estruturados para esta turma e data.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {events.slice(0, 12).map((event) => (
              <div key={event.id} className="ds-surface flex items-start justify-between gap-3 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-normal text-[var(--text-primary)]">{event.childName}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">{event.title}</p>
                </div>
                <span className={`ds-badge shrink-0 rounded-full px-2 py-1 text-[10px] ${event.optimistic ? 'ds-badge-amber' : 'ds-badge-green'}`}>
                  {event.optimistic ? 'Offline' : 'Salvo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {saving && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl ds-card px-4 py-3 text-sm text-[var(--text-primary)] shadow-xl">
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando registros reais...
        </div>
      )}
      {message && !saving && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl ds-card px-4 py-3 text-sm text-[var(--text-primary)] shadow-xl">
          {message}
        </div>
      )}
    </div>
  );
}
