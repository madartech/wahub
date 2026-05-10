import { useEffect, useState, useCallback } from 'react';
import { gatewayService } from '@/services/gateway';
import { deriveHealth } from '@/components/operations/HealthBadge';
import { GatewayUser, SessionStatus } from '@/types/gateway';
import { Users, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Counts { total: number; connected: number; disconnected: number }

export default function UsersCounterWidget({ className }: { className?: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  const fetchCounts = useCallback(async () => {
    const list = await gatewayService.getUsers();
    if (!list.ok) return;
    const enriched = await Promise.all(
      list.users.map(async (u): Promise<GatewayUser> => {
        try {
          const s = await gatewayService.getUserStatus(u.id);
          return {
            ...u,
            sessionStatus: (s.session?.status || u.sessionStatus || 'UNKNOWN') as SessionStatus,
          };
        } catch {
          return u;
        }
      })
    );
    let connected = 0;
    enriched.forEach((u) => {
      if (deriveHealth(u).level === 'healthy') connected++;
    });
    setCounts({
      total: enriched.length,
      connected,
      disconnected: enriched.length - connected,
    });
  }, []);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, 60_000);
    return () => clearInterval(id);
  }, [fetchCounts]);

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
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-sm font-bold tabular-nums">{value}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{label}</span>
      </div>
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
