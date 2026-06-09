import { useEffect, useState, useCallback } from 'react';
import { gatewayService } from '@/services/gateway';
import { deriveHealth } from '@/components/operations/HealthBadge';
import { Users, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Counts { total: number; connected: number; disconnected: number }

export default function UsersCounterWidget({ className }: { className?: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  const fetchCounts = useCallback(async () => {
    // Use only the cheap /admin/users list — no per-user status fan-out.
    // sessionStatus on the list reflects the last known WAHA state, which is
    // enough for the header counter. Live per-user truth lives on Operations.
    const list = await gatewayService.getUsers();
    if (!list.ok) return;
    let connected = 0;
    list.users.forEach((u) => {
      if (deriveHealth(u).level === 'healthy') connected++;
    });
    setCounts({
      total: list.users.length,
      connected,
      disconnected: list.users.length - connected,
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
