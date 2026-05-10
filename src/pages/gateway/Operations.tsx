import { useEffect, useMemo, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Activity } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { GatewayUser, HealthLevel, SessionStatus, WatchdogUserConfig } from '@/types/gateway';
import OperationsTable from '@/components/operations/OperationsTable';
import OperationsCards from '@/components/operations/OperationsCards';
import { deriveHealth } from '@/components/operations/HealthBadge';
import WatchdogPanel from '@/components/operations/WatchdogPanel';
import { useGatewayPolling } from '@/hooks/useGatewayPolling';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type Filter = 'all' | HealthLevel;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'needs_qr', label: 'Needs QR' },
  { key: 'stuck', label: 'Stuck' },
  { key: 'offline', label: 'Offline' },
  { key: 'paused', label: 'Paused' },
];

export default function Operations() {
  const [users, setUsers] = useState<GatewayUser[]>([]);
  const [watchdogUsers, setWatchdogUsers] = useState<Record<string, WatchdogUserConfig>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const isMobile = useIsMobile();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const list = await gatewayService.getUsers();
    if (!list.ok) {
      setError(list.error || 'Failed to fetch users');
      setLoading(false);
      return;
    }
    // Enrich with live status (in parallel, capped)
    const enriched = await Promise.all(
      list.users.map(async (u) => {
        try {
          const s = await gatewayService.getUserStatus(u.id);
          return {
            ...u,
            sessionStatus: (s.session?.status || u.sessionStatus || 'UNKNOWN') as SessionStatus,
            phoneNumber: s.phoneNumber ?? u.phoneNumber ?? null,
            pushName: s.me?.pushName ?? u.pushName ?? null,
            me: s.me ?? u.me ?? null,
          } as GatewayUser;
        } catch {
          return u;
        }
      })
    );
    setUsers(enriched);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useGatewayPolling(fetchAll, 30_000, { paused: modalOpen });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.name} ${u.id} ${u.instanceId} ${u.phoneNumber || u.me?.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter !== 'all') {
        const h = deriveHealth(u).level;
        if (filter === 'stuck' && h !== 'stuck' && h !== 'starting') return false;
        if (filter !== 'stuck' && h !== filter) return false;
      }
      return true;
    });
  }, [users, search, filter]);

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gateway Operations</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage WAHA instances. Auto-refresh every 30s
            {modalOpen ? ' (paused — modal open)' : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchAll} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, instance, phone…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Badge
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Badge>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <Activity className="mr-1 inline h-4 w-4" /> {error}
        </div>
      )}

      {isMobile
        ? <OperationsCards users={filtered} onChanged={fetchAll} onModalChange={setModalOpen} />
        : <OperationsTable users={filtered} onChanged={fetchAll} onModalChange={setModalOpen} />}
    </div>
  );
}
