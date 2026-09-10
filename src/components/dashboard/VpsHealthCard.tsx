import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Cpu, HardDrive, MemoryStick, Server, Clock } from 'lucide-react';
import { GATEWAY_BASE_URL, ADMIN_TOKEN } from '@/config/gateway';
import { cn } from '@/lib/utils';

interface VpsMetrics {
  at: string;
  host: { hostname: string; platform: string; uptimeSeconds: number };
  cpu: { cores: number; usagePercent: number | null; load1: number; load5: number; load15: number; loadPerCore1: number };
  memory: { total: number; used: number; usedPercent: number };
  disk: { total: number; used: number; usedPercent: number } | null;
  process: { uptimeSeconds: number; rss: number; node: string };
}

const POLL_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 8_000;

type Result =
  | { kind: 'metrics'; data: VpsMetrics }
  | { kind: 'unsupported' }   // add-on not installed on the server
  | { kind: 'unreachable' };

async function fetchMetrics(): Promise<Result> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/system/metrics?_t=${Date.now()}`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Cache-Control': 'no-cache' },
    });
    const data = await res.json().catch(() => null);
    if (data?.ok === true && data?.cpu) return { kind: 'metrics', data: data as VpsMetrics };
    return { kind: 'unsupported' };
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(t);
  }
}

function fmtBytes(n: number) {
  if (!n) return '—';
  const gb = n / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(n / 1024 ** 2)} MB`;
}

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function tone(pct: number | null) {
  if (pct == null) return 'bg-muted';
  if (pct < 70) return 'bg-success';
  if (pct < 88) return 'bg-warning';
  return 'bg-destructive';
}

export default function VpsHealthCard() {
  const [result, setResult] = useState<Result | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(POLL_INTERVAL_MS / 1000);
  const mounted = useRef(true);

  const run = async () => {
    setIsChecking(true);
    setSecondsLeft(POLL_INTERVAL_MS / 1000);
    const r = await fetchMetrics();
    if (!mounted.current) return;
    setResult(r);
    setIsChecking(false);
  };

  useEffect(() => {
    mounted.current = true;
    let id: number | undefined;

    const start = () => {
      if (id != null) return;
      run();
      id = window.setInterval(run, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (id != null) window.clearInterval(id);
      id = undefined;
    };

    if (document.visibilityState === 'visible') start();
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    document.addEventListener('visibilitychange', onVisibility);

    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setSecondsLeft((s) => (s <= 1 ? POLL_INTERVAL_MS / 1000 : s - 1));
    }, 1000);

    return () => {
      mounted.current = false;
      stop();
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = result?.kind === 'metrics' ? result.data : null;

  // Health is judged purely on server-side numbers.
  const cpuPct = m?.cpu.usagePercent ?? null;
  const memPct = m?.memory.usedPercent ?? null;
  const diskPct = m?.disk?.usedPercent ?? null;
  const saturated = m ? m.cpu.loadPerCore1 > 1.5 : false;
  const worst = Math.max(cpuPct ?? 0, memPct ?? 0, diskPct ?? 0);

  const overall: 'healthy' | 'strained' | 'critical' | 'unknown' =
    !m ? 'unknown' : worst >= 92 || saturated ? 'critical' : worst >= 80 ? 'strained' : 'healthy';

  const badge =
    result == null ? <Badge variant="secondary">Reading…</Badge>
    : result.kind === 'unreachable' ? <Badge variant="destructive">Server not answering</Badge>
    : result.kind === 'unsupported' ? <Badge variant="secondary">Metrics add-on not installed</Badge>
    : overall === 'healthy' ? <Badge className="bg-success text-success-foreground">Healthy</Badge>
    : overall === 'strained' ? <Badge className="bg-warning text-warning-foreground">Under load</Badge>
    : <Badge variant="destructive">Critical</Badge>;

  let reason = '';
  if (result == null) reason = 'Reading server resources…';
  else if (result.kind === 'unreachable') reason = 'No reply from the server';
  else if (result.kind === 'unsupported') reason = 'Install the metrics add-on on the server to see CPU, memory and disk';
  else if (overall === 'healthy') reason = `${m!.host.hostname} · up ${fmtUptime(m!.host.uptimeSeconds)}`;
  else {
    const r: string[] = [];
    if (cpuPct != null && cpuPct >= 80) r.push(`CPU ${cpuPct}%`);
    if (memPct != null && memPct >= 80) r.push(`memory ${memPct}%`);
    if (diskPct != null && diskPct >= 80) r.push(`disk ${diskPct}%`);
    if (saturated) r.push(`load ${m!.cpu.load1} on ${m!.cpu.cores} cores`);
    reason = r.join(' · ') || 'Resources under pressure';
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            VPS Health
          </CardTitle>
          <CardDescription>CPU, memory and disk measured on the server</CardDescription>
        </div>
        <Activity className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {badge}
            <span className="text-sm text-muted-foreground truncate">{reason}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={run} disabled={isChecking}>
            <RefreshCw className={cn('h-4 w-4', isChecking && 'animate-spin')} />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Gauge
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="CPU"
            pct={cpuPct}
            sub={m ? `${m.cpu.cores} cores · load ${m.cpu.load1} / ${m.cpu.load5} / ${m.cpu.load15}` : undefined}
          />
          <Gauge
            icon={<MemoryStick className="h-3.5 w-3.5" />}
            label="Memory"
            pct={memPct}
            sub={m ? `${fmtBytes(m.memory.used)} of ${fmtBytes(m.memory.total)}` : undefined}
          />
          <Gauge
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Disk"
            pct={diskPct}
            sub={m?.disk ? `${fmtBytes(m.disk.used)} of ${fmtBytes(m.disk.total)}` : undefined}
          />
        </div>

        {m && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Server uptime" value={fmtUptime(m.host.uptimeSeconds)} />
            <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Gateway uptime" value={fmtUptime(m.process.uptimeSeconds)} />
            <Stat icon={<MemoryStick className="h-3.5 w-3.5" />} label="Gateway memory" value={fmtBytes(m.process.rss)} />
          </div>
        )}

        <p className="text-[10px] text-muted-foreground tabular-nums">
          Read from the server every minute · next read in {secondsLeft}s
          {m ? ` · last ${new Date(m.at).toLocaleTimeString()}` : ''} · paused while this tab is in the background
        </p>
      </CardContent>
    </Card>
  );
}

function Gauge({ icon, label, pct, sub }: { icon: React.ReactNode; label: string; pct: number | null; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="tabular-nums text-xs font-semibold text-foreground">{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', tone(pct))} style={{ width: `${pct ?? 0}%` }} />
      </div>
      {sub && <div className="mt-1.5 text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
