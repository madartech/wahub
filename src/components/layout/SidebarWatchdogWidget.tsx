import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gatewayService } from '@/services/gateway';
import { WatchdogConfig } from '@/types/gateway';
import { useToast } from '@/hooks/use-toast';

export default function SidebarWatchdogWidget() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<WatchdogConfig | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [notDeployed, setNotDeployed] = useState(false);
  const [busy, setBusy] = useState(false);

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
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const toggleEnabled = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!config) return;
    setBusy(true);
    const res = await gatewayService.updateWatchdogConfig({ enabled: !config.enabled });
    setBusy(false);
    if (!res.ok) toast({ title: 'Failed', description: res.error, variant: 'destructive' });
    else load();
  };

  const runNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    const res = await gatewayService.runWatchdogOnce();
    setBusy(false);
    if (!res.ok) toast({ title: 'Run failed', description: res.error, variant: 'destructive' });
    else { toast({ title: 'Watchdog tick complete' }); load(); }
  };

  const enabled = !!config?.enabled;

  return (
    <button
      onClick={() => navigate('/admin/operations')}
      className="w-full text-left rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 hover:bg-sidebar-accent/60 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className={cn('h-4 w-4 shrink-0', enabled ? 'text-primary' : 'text-muted-foreground')} />
          <span className="text-sm font-medium text-sidebar-foreground truncate">Watchdog</span>
        </div>
        {!notDeployed && config && (
          <span
            onClick={toggleEnabled}
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded border cursor-pointer select-none',
              enabled
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-muted text-muted-foreground border-border',
              busy && 'opacity-50',
            )}
          >
            {enabled ? 'ON' : 'OFF'}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground truncate">
          {notDeployed
            ? 'Backend not deployed'
            : config
              ? `Every ${config.intervalMinutes}m · ${lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : '—'}`
              : 'Loading…'}
        </div>
        {!notDeployed && config && (
          <span
            onClick={runNow}
            className={cn(
              'inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer',
              busy && 'opacity-50 pointer-events-none',
            )}
            title="Run watchdog now"
          >
            <Play className="h-3 w-3" /> Run
          </span>
        )}
      </div>
    </button>
  );
}
