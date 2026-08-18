/**
 * diary.api.ts — API de Diário de Bordo com suporte offline (IndexedDB queue)
 * Missão 03 — UX 2 Segundos
 */
import http from './http';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type MicroGestureType =
  | 'SONO'
  | 'ALIMENTACAO'
  | 'FRALDA'
  | 'HUMOR'
  | 'INCIDENTE'
  | 'HIGIENE';

export interface DiaryEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  eventDate: string;
  childId: string;
  classroomId: string;
  planningId?: string | null;
  curriculumEntryId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CreateDiaryEventDto {
  type: string;
  title: string;
  description: string;
  eventDate: string;
  childId: string;
  classroomId: string;
  planningId?: string;
  curriculumEntryId?: string;
  observations?: string;
  developmentNotes?: string;
  behaviorNotes?: string;
  medicaoAlimentar?: Record<string, unknown>;
  sonoMinutos?: number;
  trocaFraldaStatus?: string;
  microgestos?: Array<Record<string, unknown>>;
  tags?: string[];
  aiContext?: Record<string, unknown>;
  status?: 'RASCUNHO' | 'PUBLICADO' | 'REVISADO' | 'ARQUIVADO';
}

export interface MicroGesturePayload {
  type: MicroGestureType;
  action?: string;
  childId: string;
  classroomId: string;
  timestamp: Date;
}

// ─── Fila IndexedDB (offline queue) ──────────────────────────────────────────

const IDB_NAME = 'zelare_offline';
const IDB_STORE = 'diary_queue';
const IDB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueOffline(payload: CreateDiaryEventDto): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add({ payload, enqueuedAt: new Date().toISOString() });
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('[DiaryAPI] Falha ao enfileirar offline:', err);
  }
}

export async function flushOfflineQueue(): Promise<number> {
  if (!navigator.onLine) return 0;
  let flushed = 0;
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const all: Array<{ key: IDBValidKey; payload: CreateDiaryEventDto }> = await new Promise(
      (res, rej) => {
        const items: Array<{ key: IDBValidKey; payload: CreateDiaryEventDto }> = [];
        const cursor = store.openCursor();
        cursor.onsuccess = (e) => {
          const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (c) {
            items.push({ key: c.key, payload: (c.value as { payload: CreateDiaryEventDto }).payload });
            c.continue();
          } else {
            res(items);
          }
        };
        cursor.onerror = () => rej(cursor.error);
      }
    );

    for (const item of all) {
      try {
        await createDiaryEvent(item.payload);
        store.delete(item.key);
        flushed++;
      } catch {
        // Mantém na fila se ainda falhar
      }
    }
  } catch (err) {
    console.warn('[DiaryAPI] Falha ao descarregar fila offline:', err);
  }
  return flushed;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanPayload<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

// ─── API Functions ────────────────────────────────────────────────────────────

export type DiaryQuality = {
  scope: 'real';
  window: { start: string; end: string; days: number };
  capped: boolean;
  totals: {
    events: number;
    distinctChildren: number;
    distinctClassrooms: number;
    documented: number;
    structured: number;
    authored: number;
    published: number;
  };
  coverage: {
    documentationPercent: number;
    structuredPercent: number;
    authorshipPercent: number;
    publicationPercent: number;
  };
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  daily: Array<{ date: string; total: number; documented: number; structured: number; authored: number }>;
};

export async function getDiaryEvents(params?: {
  childId?: string;
  classroomId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DiaryEvent[]> {
  const response = await http.get('/diary-events', { params });
  return response.data;
}

export async function getDiaryQuality(params?: {
  classroomId?: string;
  childId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DiaryQuality> {
  const response = await http.get('/diary-events/quality', { params });
  return response.data;
}

export async function createDiaryEvent(data: CreateDiaryEventDto): Promise<DiaryEvent> {
  const cleaned = cleanPayload(data as unknown as Record<string, unknown>);

  const required: (keyof CreateDiaryEventDto)[] = ['type', 'title', 'description', 'eventDate', 'childId', 'classroomId'];
  for (const field of required) {
    if (!cleaned[field]) throw new Error(`Campo obrigatório ausente: ${field}`);
  }

  const response = await http.post('/diary-events', cleaned);
  return response.data;
}

/**
 * Registra um micro-gesto com suporte offline.
 * Se offline → enfileira no IndexedDB e retorna um evento otimista.
 * Se online  → envia direto e retorna o evento real.
 */
export async function registerStructuredDailyObservation(payload: {
  childId: string;
  classroomId: string;
  eventDate: string;
  categoria: string;
  microgestoId: string;
  nivel: string;
  descricao?: string;
  campoExperiencia?: string;
}): Promise<DiaryEvent & { _optimistic?: boolean }> {
  const description = payload.descricao?.trim() || `Nível observado: ${payload.nivel}`;
  const dto: CreateDiaryEventDto = {
    type: 'DESENVOLVIMENTO',
    title: `Coleta estruturada: ${payload.microgestoId}`,
    description,
    eventDate: new Date(`${payload.eventDate}T12:00:00`).toISOString(),
    childId: payload.childId,
    classroomId: payload.classroomId,
    developmentNotes: description,
    microgestos: [{
      categoria: payload.categoria,
      microgestoId: payload.microgestoId,
      nivel: payload.nivel,
      campoExperiencia: payload.campoExperiencia,
    }],
    tags: ['coleta_estruturada', payload.categoria.toLowerCase(), payload.microgestoId.toLowerCase()],
    aiContext: {
      source: 'daily-collection',
      categoria: payload.categoria,
      microgestoId: payload.microgestoId,
      nivel: payload.nivel,
      campoExperiencia: payload.campoExperiencia,
    },
  };

  if (!navigator.onLine) {
    await enqueueOffline(dto);
    return {
      id: `optimistic_${Date.now()}_${payload.childId}`,
      ...dto,
      _optimistic: true,
    };
  }

  return createDiaryEvent(dto);
}

export async function registerMicroGesture(
  payload: MicroGesturePayload
): Promise<DiaryEvent & { _optimistic?: boolean }> {
  const dto: CreateDiaryEventDto = {
    type: payload.type,
    title: `Micro-Gesto: ${payload.type}${payload.action ? ` — ${payload.action}` : ''}`,
    description: payload.action ?? payload.type,
    eventDate: payload.timestamp.toISOString(),
    childId: payload.childId,
    classroomId: payload.classroomId,
  };

  if (!navigator.onLine) {
    await enqueueOffline(dto);
    // Retorna evento otimista local
    return {
      id: `optimistic_${Date.now()}`,
      ...dto,
      createdAt: dto.eventDate,
      _optimistic: true,
    };
  }

  return createDiaryEvent(dto);
}

export async function getDiaryEventsByChild(childId: string): Promise<DiaryEvent[]> {
  const response = await http.get(`/diary-events`, { params: { childId } });
  return response.data;
}
