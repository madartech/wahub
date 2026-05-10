import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Play, ScrollText, Shield } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { WatchdogConfig, WatchdogUserConfig } from '@/types/gateway';
import { useToast } from '@/hooks/use-toast';
import WatchdogLogsDialog from './dialogs/WatchdogLogsDialog';

interface Props {
  onUsersConfig?: (m: Record<string, WatchdogUserConfig>) => void;
}

export default function WatchdogPanel({ onUsersConfig }: Props) {
  const [config, setConfig] = useState<WatchdogConfig | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [notDeployed, setNotDeployed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const res = await gatewayService.getWatchdogStatus();
    if (!res.ok) {
      setNotDeployed(!!res.notDeployed);
      setConfig(null);
      return;
    }
    setNotDeployed(false);
    setConfig(res.config || null);
    setLastRunAt(res.lastRunAt || null);
    if (onUsersConfig && res.users) onUsersConfig(res.users);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const update = async (patch: Partial<WatchdogConfig>) => {
    setLoading(true);
    const res = await gatewayService.updateWatchdogConfig(patch);
    setLoading(false);
    if (!res.ok) {
      toast({ title: 'Failed', description: res.error, variant: 'destructive' });
      return;
    }
    await load();
  };

  const runNow = async () => {
    setLoading(true);
    const res = await gatewayService.runWatchdogOnce();
    setLoading(false);
    if (!res.ok) {
      toast({ title: 'Run failed', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Watchdog tick complete' });
      load();
    }
  };

  if (notDeployed) {
    return (
      <Card className="p-3 border-dashed">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          Watchdog backend not deployed yet — apply <code>docs/gateway-watchdog-patch.js</code>.
        </div>
      </Card>
    );
  }

  if (!config) {
    return <Card className="p-3 text-sm text-muted-foreground">Loading watchdog…</Card>;
  }

  return (
    <Card className="p-3 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary" />
          <div>
            <div className="font-semibold text-sm">Watchdog</div>
            <div className="text-xs text-muted-foreground">
              Interval: {config.intervalMinutes} min · Stuck threshold: {config.stuckStartingMinutes} min ·
              Repeat window: {config.repeatedFailureWindowMinutes} min
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={config.enabled}
              disabled={loading}
              onCheckedChange={(v) => update({ enabled: v })}
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={config.autoRestart}
              disabled={loading}
              onCheckedChange={(v) => update({ autoRestart: v })}
            />
            Auto-restart
          </label>
          <Badge variant="outline" className="text-[10px]">
            Last run: {lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : '—'}
          </Badge>
          <Button size="sm" variant="outline" disabled={loading} onClick={runNow}>
            <Play className="h-3 w-3 mr-1" /> Run now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLogsOpen(true)}>
            <ScrollText className="h-3 w-3 mr-1" /> Logs
          </Button>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        Auto-reset disconnects WhatsApp and requires scanning the QR again. It is opt-in per instance.
      </div>
      <WatchdogLogsDialog open={logsOpen} onOpenChange={setLogsOpen} />
    </Card>
  );
}
