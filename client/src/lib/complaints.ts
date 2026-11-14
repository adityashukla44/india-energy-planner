import { create } from 'zustand';

export const COMPLAINT_TYPES = ['outage', 'low_voltage', 'fluctuation', 'sparking', 'streetlight', 'billing', 'other'] as const;
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];
export const STATUSES = ['logged', 'routed', 'acknowledged', 'resolved'] as const;

export interface NewComplaint {
  type: ComplaintType;
  state: string;
  district: string;
  details: string;
  contact?: string;
}
export interface QueuedComplaint extends NewComplaint {
  clientId: string;
  queuedAt: string;
}
export interface PublicComplaint {
  ticketId: string;
  type: ComplaintType;
  state: string;
  district: string;
  details: string;
  status: (typeof STATUSES)[number];
  sample: boolean;
  createdAt: string;
}

/* ---------- tiny IndexedDB wrapper (offline queue) ---------- */
const DB = 'iep-offline';
const STORE = 'complaint-queue';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const queueAll = () => tx<QueuedComplaint[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedComplaint[]>).catch(() => [] as QueuedComplaint[]);
const queuePut = (c: QueuedComplaint) => tx('readwrite', (s) => s.put(c));
const queueDel = (id: string) => tx('readwrite', (s) => s.delete(id));

/* ---------- my tickets (localStorage, guarded) ---------- */
const MINE = 'iep-my-tickets';
export function myTickets(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MINE) ?? '[]');
  } catch {
    return [];
  }
}
function addMine(id: string) {
  try {
    localStorage.setItem(MINE, JSON.stringify([id, ...myTickets().filter((x) => x !== id)].slice(0, 50)));
  } catch {
    /* storage blocked */
  }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function post(c: NewComplaint & { clientId: string }): Promise<{ ticketId: string; status: string }> {
  const r = await fetch('/api/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
  if (r.status === 400) {
    const body = await r.json().catch(() => ({}));
    const e = new Error('invalid') as Error & { issues?: unknown; permanent?: boolean };
    e.issues = body.issues;
    e.permanent = true;
    throw e;
  }
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

interface QueueState {
  pending: QueuedComplaint[];
  refresh: () => Promise<void>;
}
export const useQueue = create<QueueState>((set) => ({
  pending: [],
  refresh: async () => set({ pending: await queueAll() }),
}));

/** Sends now if possible, otherwise stores in IndexedDB to sync when back online. */
export async function submitComplaint(c: NewComplaint): Promise<{ ticketId?: string; queued: boolean }> {
  const item: QueuedComplaint = { ...c, clientId: uid(), queuedAt: new Date().toISOString() };
  if (navigator.onLine) {
    try {
      const r = await post(item);
      addMine(r.ticketId);
      return { ticketId: r.ticketId, queued: false };
    } catch (e) {
      if ((e as { permanent?: boolean }).permanent) throw e;
    }
  }
  await queuePut(item);
  await useQueue.getState().refresh();
  return { queued: true };
}

let flushing = false;
/** Sends queued complaints; the server de-duplicates by clientId, so retries are safe. */
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of await queueAll()) {
      try {
        const r = await post(item);
        addMine(r.ticketId);
        await queueDel(item.clientId);
        sent++;
      } catch (e) {
        if ((e as { permanent?: boolean }).permanent) await queueDel(item.clientId);
        else break;
      }
    }
  } finally {
    flushing = false;
    await useQueue.getState().refresh();
  }
  return sent;
}

let installed = false;
export function installSync(onSent?: (n: number) => void) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const run = () => flushQueue().then((n) => n && onSent?.(n));
  window.addEventListener('online', run);
  void useQueue.getState().refresh();
  run();
}

export async function fetchComplaints(params: Record<string, string | undefined>): Promise<PublicComplaint[]> {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const r = await fetch(`/api/complaints?${q}`);
  if (!r.ok) throw new Error('list_failed');
  return r.json();
}
