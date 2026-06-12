import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Gauge, Wifi, Server, Zap } from 'lucide-react';
import { GATEWAY_BASE_URL } from '@/config/gateway';
import { cn } from '@/lib/utils';

interface PingSample {
  ok: boolean;
  latency: number; // ms (only meaningful when ok)
  at: number;
}

const HISTORY_SIZE = 20;        // last 20 pings drive uptime %
const POLL_INTERVAL_MS = 15_000; // 15s — light, no auth needed
const TIMEOUT_MS = 6_000;

async function ping(): Promise<PingSample> {
  const start = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/health?_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    const latency = Math.round(performance.now() - start);
    let ok = false;
    try {
      const data = await res.json();
      ok = res.ok && data?.ok === true;
    } catch {
      ok = res.ok;
    }
    return { ok, latency, at: Date.now() };
  } catch {
    return { ok: false, latency: Math.round(performance.now() - start), at: Date.now() };
  } finally {
    clearTimeout(t);
  }
}

function latencyTier(ms: number): { label: string; tone: string } {
  if (ms < 150) return { label: 'Excellent', tone: 'bg-success text-success-foreground' };
  if (ms < 400) return { label: 'Good', tone: 'bg-success/80 text-success-foreground' };
  if (ms < 800) return { label: 'Slow', tone: 'bg-warning text-warning-foreground' };
  return { label: 'Very slow', tone: 'bg-destructive text-destructive-foreground' };
}

export default function VpsHealthCard() {
  const [history, setHistory] = useState<PingSample[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const mounted = useRef(true);

  const runPing = async () => {
    setIsChecking(true);
    const sample = await ping();
    if (!mounted.current) return;
    setHistory((prev) => [...prev, sample].slice(-HISTORY_SIZE));
    setIsChecking(false);
  };

  useEffect(() => {
    mounted.current = true;
    runPing();
    const id = window.setInterval(runPing, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = history[history.length - 1];
  const successes = history.filter((s) => s.ok);
  const uptimePct = history.length === 0 ? null : Math.round((successes.length / history.length) * 100);
  const avgLatency = successes.length === 0 ? null : Math.round(successes.reduce((a, s) => a + s.latency, 0) / successes.length);
  const minLatency = successes.length === 0 ? null : Math.min(...successes.map((s) => s.latency));
  const maxLatency = successes.length === 0 ? null : Math.max(...successes.map((s) => s.latency));
  const jitter = successes.length < 2 || avgLatency == null
    ? null
    : Math.round(
        Math.sqrt(
          successes.reduce((a, s) => a + (s.latency - avgLatency) ** 2, 0) / successes.length,
        ),
      );

  const overall: 'online' | 'degraded' | 'offline' | 'checking' =
    history.length === 0
      ? 'checking'
      : !last?.ok
        ? 'offline'
        : (uptimePct ?? 100) < 80 || (avgLatency ?? 0) > 800
          ? 'degraded'
          : 'online';

  const overallBadge =
    overall === 'online' ? <Badge className="bg-success text-success-foreground">Online</Badge>
    : overall === 'degraded' ? <Badge className="bg-warning text-warning-foreground">Degraded</Badge>
    : overall === 'offline' ? <Badge variant="destructive">Offline</Badge>
    : <Badge variant="secondary">Checking…</Badge>;

  const tier = avgLatency == null ? null : latencyTier(avgLatency);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            VPS Health
          </CardTitle>
          <CardDescription>Live latency, uptime and connectivity</CardDescription>
        </div>
        <Activity className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {overallBadge}
            <span className="text-sm text-muted-foreground">
              {overall === 'online' && 'Gateway responding normally'}
              {overall === 'degraded' && 'Reachable but slow or flaky'}
              {overall === 'offline' && 'Gateway not responding'}
              {overall === 'checking' && 'Running first health check…'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={runPing} disabled={isChecking}>
            <RefreshCw className={cn('h-4 w-4', isChecking && 'animate-spin')} />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Latency"
            value={last?.ok ? `${last.latency} ms` : '—'}
            sub={tier ? tier.label : undefined}
          />
          <Metric
            icon={<Gauge className="h-3.5 w-3.5" />}
            label="Avg / Jitter"
            value={avgLatency != null ? `${avgLatency} ms` : '—'}
            sub={jitter != null ? `± ${jitter} ms` : undefined}
          />
          <Metric
            icon={<Wifi className="h-3.5 w-3.5" />}
            label="Uptime"
            value={uptimePct != null ? `${uptimePct}%` : '—'}
            sub={history.length > 0 ? `last ${history.length} checks` : undefined}
          />
          <Metric
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Min / Max"
            value={minLatency != null && maxLatency != null ? `${minLatency}/${maxLatency}` : '—'}
            sub="ms"
          />
        </div>

        {/* Sparkline-ish strip */}
        <div>
          <div className="flex items-end gap-0.5 h-10">
            {Array.from({ length: HISTORY_SIZE }).map((_, i) => {
              const idx = history.length - HISTORY_SIZE + i;
              const s = idx >= 0 ? history[idx] : undefined;
              if (!s) {
                return <div key={i} className="flex-1 h-1 rounded-sm bg-muted" />;
              }
              const clamped = Math.min(s.latency, 1200);
              const h = s.ok ? Math.max(8, Math.round((clamped / 1200) * 100)) : 100;
              const color = !s.ok
                ? 'bg-destructive'
                : s.latency < 150 ? 'bg-success'
                : s.latency < 400 ? 'bg-success/70'
                : s.latency < 800 ? 'bg-warning'
                : 'bg-destructive/80';
              return (
                <div
                  key={i}
                  className={cn('flex-1 rounded-sm transition-all', color)}
                  style={{ height: `${h}%` }}
                  title={`${new Date(s.at).toLocaleTimeString()} — ${s.ok ? `${s.latency} ms` : 'failed'}`}
                />
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Pinged every {POLL_INTERVAL_MS / 1000}s · CPU / RAM / disk require a backend endpoint
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
