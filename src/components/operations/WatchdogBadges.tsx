import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GatewayUser, WatchdogUserConfig } from '@/types/gateway';
import { deriveHealth } from './HealthBadge';

interface Props {
  user: GatewayUser;
  cfg?: WatchdogUserConfig;
}

const STYLES = {
  autoHeal: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
  restarted: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  repeated: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  needsQr: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  resetOff: 'bg-muted text-muted-foreground border-border',
};

export default function WatchdogBadges({ user, cfg }: Props) {
  const health = deriveHealth(user).level;
  const failures = (cfg?.failures || []).length;
  const recentRestart =
    cfg?.lastAction?.action === 'auto_restart_stuck_starting' &&
    cfg?.lastAction?.at &&
    Date.now() - new Date(cfg.lastAction.at).getTime() < 10 * 60_000;

  return (
    <div className="flex flex-wrap gap-1">
      {cfg?.autoHeal !== false && (
        <Badge variant="outline" className={cn('text-[10px]', STYLES.autoHeal)}>Auto-heal</Badge>
      )}
      {recentRestart && (
        <Badge variant="outline" className={cn('text-[10px]', STYLES.restarted)}>Restarted</Badge>
      )}
      {failures >= 1 && (
        <Badge variant="outline" className={cn('text-[10px]', STYLES.repeated)}>Repeated failure</Badge>
      )}
      {health === 'needs_qr' && (
        <Badge variant="outline" className={cn('text-[10px]', STYLES.needsQr)}>Needs QR</Badge>
      )}
      {failures >= 1 && cfg?.autoReset === false && (
        <Badge variant="outline" className={cn('text-[10px]', STYLES.resetOff)}>Auto-reset off</Badge>
      )}
    </div>
  );
}
