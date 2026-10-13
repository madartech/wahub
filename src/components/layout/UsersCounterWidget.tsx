import { useEffect, useState, useCallback, useRef } from 'react';
import { gatewayService } from '@/services/gateway';
import { deriveHealth } from '@/components/operations/HealthBadge';
import { statusCache } from '@/services/statusCache';
import { GatewayUser, SessionStatus } from '@/types/gateway';
import { Users, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Counts { total: number; connected: number; disconnected: number }

function countFrom(list: GatewayUser[]): Counts {
  let connected = 0;
  list.forEach((u) => {
    const cached = statusCache.get(u.id);
    const effective: SessionStatus = cached || u.sessionStatus || 'UNKNOWN';
    const merged = { ...u, sessionStatus: effective } as GatewayUser;
    if (deriveHealth(merged).level === 'healthy') connected++;
  });
  return {
    total: list.length,
    connected,
    disconnected: list.length - connected,
  };
}

export default function UsersCounterWidget({ className }: { className?: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const usersRef = useRef<GatewayUser[]>([]);
  const listAtRef = useRef(0);
  const [serverAt, setServerAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState(false);
  const prevOnRef = useRef<number | null>(null);

  const recompute = useCallback(() => {
    const c = countFrom(usersRef.current);
    if (prevOnRef.current !== null && prevOnRef.current !== c.connected) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
    }
    prevOnRef.current = c.connected;
    setCounts(c);
  }, []);

  const fetchAndEnrich = useCallback(async () => {
    // Account list changes rarely: refresh it every 60s; statuses every 10s.
    if (!usersRef.current.length || Date.now() - listAtRef.current > 60_000) {
      const list = await gatewayService.getUsers();
      if (!list.ok) return;
      usersRef.current = list.users;
      listAtRef.current = Date.now();
    }
    const list = { users: usersRef.current };

    // Fast path: one call returns every account's status from the server cache.
    const bulk = await gatewayService.getAllStatuses();
    if (bulk.ok) {
      statusCache.setMany(
        Object.entries(bulk.statuses).map(([id, v]) => ({ id, status: (v.status || 'UNKNOWN') as SessionStatus })),
      );
      setServerAt(bulk.refreshedAt || Date.now());
      recompute();
      return;
    }

    // Fallback: per-account checks, only for entries without a fresh cache value.
    const stale = list.users.filter((u) => {
      const age = statusCache.getAge(u.id);
      return age === undefined || age > 90_000;
    });
    const queue = [...stale];
    const concurrency = 4;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length) {
          const u = queue.shift()!;
          try {
            const s = await gatewayService.getUserStatus(u.id);
            statusCache.set(u.id, (s.session?.status || 'UNKNOWN') as SessionStatus);
          } catch {
            // ignore
          }
        }
      })
    );
    recompute();
  }, [recompute]);

  useEffect(() => {
    fetchAndEnrich();
    const id = setInterval(fetchAndEnrich, 10_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const unsub = statusCache.subscribe(recompute);
    return () => {
      clearInterval(id);
      clearInterval(tick);
      unsub();
    };
  }, [fetchAndEnrich, recompute]);

  const Item = ({
    icon: Icon,
    value,
    label,
    tone,
  }: {
    icon: typeof Users;
    value: number | string;
    label: string;
    tone: 'total' | 'on' | 'off';
  }) => (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 w-full',
        tone === 'total' && 'bg-muted/40 border-border text-foreground',
        tone === 'on' && 'bg-success/10 border-success/30 text-success',
        tone === 'off' && 'bg-destructive/10 border-destructive/30 text-destructive',
      )}
      title={label}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide truncate">{label}</span>
      </div>
      <span className="text-base font-bold tabular-nums leading-none">{value}</span>
    </div>
  );

  const placeholder = counts === null;
  const ageS = serverAt ? Math.max(0, Math.round((now - serverAt) / 1000)) : null;
  const live = ageS !== null && ageS < 90;

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      <Item icon={Users} value={placeholder ? '–' : counts!.total} label="Total" tone="total" />
      <div className={cn('rounded-md transition-shadow duration-500', flash && 'ring-2 ring-success')}>
        <Item icon={CheckCircle2} value={placeholder ? '–' : counts!.connected} label="On" tone="on" />
      </div>
      <Item icon={XCircle} value={placeholder ? '–' : counts!.disconnected} label="Off" tone="off" />
      <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground" title="Checked by the server every 30 seconds">
        <span className="relative flex h-2 w-2">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', live ? 'bg-success' : 'bg-muted-foreground')} />
        </span>
        <span>{ageS === null ? 'Connecting…' : live ? `Live · updated ${ageS}s ago` : `Not live · last update ${Math.round(ageS / 60)}m ago`}</span>
      </div>
    </div>
  );
}
