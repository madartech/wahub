// Shared in-memory cache of last-known per-user session status.
// Pages that enrich users via getUserStatus push results here so
// lightweight consumers (e.g. the sidebar counter) can read truth
// without making their own fan-out requests.

import { SessionStatus } from '@/types/gateway';

type Listener = () => void;

interface Entry {
  status: SessionStatus;
  updatedAt: number;
}

const store = new Map<string, Entry>();
const listeners = new Set<Listener>();

export const statusCache = {
  set(userId: string, status: SessionStatus) {
    store.set(userId, { status, updatedAt: Date.now() });
    listeners.forEach((l) => l());
  },
  setMany(entries: { id: string; status: SessionStatus }[]) {
    const now = Date.now();
    entries.forEach((e) => store.set(e.id, { status: e.status, updatedAt: now }));
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
};
