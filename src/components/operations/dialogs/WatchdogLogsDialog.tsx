import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { WatchdogLogEntry } from '@/types/gateway';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function WatchdogLogsDialog({ open, onOpenChange }: Props) {
  const [logs, setLogs] = useState<WatchdogLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await gatewayService.getWatchdogLogs(200);
    if (!res.ok) {
      setError(res.notDeployed ? 'Watchdog backend not deployed yet — apply patch.' : (res.error || 'Failed'));
      setLogs([]);
    } else {
      setLogs(res.logs || []);
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Watchdog activity log
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
            </Button>
          </DialogTitle>
        </DialogHeader>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="overflow-auto flex-1 text-xs font-mono">
          {logs.length === 0 && !error && (
            <div className="py-8 text-center text-muted-foreground">No log entries.</div>
          )}
          {logs.map((l) => (
            <div key={l.id} className="border-b py-2 px-1 flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{l.action}</span>
                <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-muted-foreground">
                {l.userId && <>user={l.userId} </>}
                {l.instanceId && <>inst={l.instanceId} </>}
                {l.reason && <>reason={l.reason} </>}
                {l.result && <>result={l.result}</>}
              </div>
              {l.oldStatus && (
                <div className="text-muted-foreground">{l.oldStatus} → {l.newStatus}</div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
