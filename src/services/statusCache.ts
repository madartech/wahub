// Shared in-memory cache of last-known per-user session status.
// Pages that enrich users push results here so lightweight consumers
// (e.g. the sidebar counter) can read truth without their own requests.
//
// "Sticky" rule: an UNKNOWN result (usually a timed-out or failed check)
// does not overwrite a known status that is younger than STICKY_MS.

import { SessionStatus } from '@/types/gateway';

type Listener = () => void;

interface Entry {
  status: SessionStatus;
  updatedAt: number;
}

export const STICKY_MS = 5 * 60_000;

const store = new Map<string, Entry>();
const listeners = new Set<Listener>();

function put(userId: string, status: SessionStatus, now: number) {
  const prev = store.get(userId);
  if (status === 'UNKNOWN' && prev && prev.status !== 'UNKNOWN' && now - prev.updatedAt < STICKY_MS) {
    return; // keep last known
  }
  store.set(userId, { status, updatedAt: now });
}

export const statusCache = {
  set(userId: string, status: SessionStatus) {
    put(userId, status, Date.now());
    listeners.forEach((l) => l());
  },
  setMany(entries: { id: string; status: SessionStatus }[]) {
    const now = Date.now();
    entries.forEach((e) => put(e.id, e.status, now));
    listeners.forEach((l) => l());
  },
  get(userId: string): SessionStatus | undefined {
    return store.get(userId)?.status;
  },
  getAge(userId: string): number | undefined {
    const e = store.get(userId);
    return e ? Date.now() - e.updatedAt : undefined;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** test helper */
  _clear() {
    store.clear();
  },
};
