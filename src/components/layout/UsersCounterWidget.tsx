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

  const recompute = useCallback(() => {
    setCounts(countFrom(usersRef.current));
  }, []);

  const fetchAndEnrich = useCallback(async () => {
    const list = await gatewayService.getUsers();
    if (!list.ok) return;
    usersRef.current = list.users;
    recompute();

    // Background top-up: only for users we don't have a fresh cache entry for.
    // Capped concurrency keeps the gateway happy.
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
    const id = setInterval(fetchAndEnrich, 120_000);
    const unsub = statusCache.subscribe(recompute);
    return () => {
      clearInterval(id);
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

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      <Item icon={Users} value={placeholder ? '–' : counts!.total} label="Total" tone="total" />
      <Item icon={CheckCircle2} value={placeholder ? '–' : counts!.connected} label="On" tone="on" />
      <Item icon={XCircle} value={placeholder ? '–' : counts!.disconnected} label="Off" tone="off" />
    </div>
  );
}
