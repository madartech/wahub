import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GatewayUser, HealthLevel, SessionStatus } from '@/types/gateway';

const STUCK_AFTER_MS = 3 * 60_000;

export function deriveHealth(user: GatewayUser): { level: HealthLevel; label: string } {
  const status = user.sessionStatus;
  const now = Date.now();
  const pausedUntil = user.pausedUntil ? new Date(user.pausedUntil).getTime() : 0;
  if (pausedUntil > now) return { level: 'paused', label: 'Paused' };

  if (user.containerStatus && /not ?found|missing|absent/i.test(user.containerStatus)) {
    return { level: 'container_missing', label: 'Container missing' };
  }

  switch (status) {
    case 'WORKING':
    case 'READY':
      return { level: 'healthy', label: 'Healthy' };
    case 'SCAN_QR_CODE':
      return { level: 'needs_qr', label: 'Needs QR' };
    case 'STARTING': {
      const since = user.statusChangedAt ? new Date(user.statusChangedAt).getTime() : 0;
      if (since && now - since > STUCK_AFTER_MS) return { level: 'stuck', label: 'Stuck starting' };
      return { level: 'starting', label: 'Starting…' };
    }
    case 'FAILED':
      return { level: 'failed', label: 'Failed' };
    case 'STOPPED':
    case 'UNKNOWN':
    default:
      return { level: 'offline', label: 'Offline' };
  }
}

const COLORS: Record<HealthLevel, string> = {
  healthy: 'bg-success/15 text-success border-success/30',
  needs_qr: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  starting: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  stuck: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  offline: 'bg-muted text-muted-foreground border-border',
  paused: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  container_missing: 'bg-destructive/15 text-destructive border-destructive/30',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function HealthBadge({ user }: { user: GatewayUser }) {
  const { level, label } = deriveHealth(user);
  return (
    <Badge variant="outline" className={cn('font-medium', COLORS[level])}>
      {label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status?: SessionStatus }) {
  return (
    <span className="text-xs font-mono text-muted-foreground">
      {status || 'UNKNOWN'}
    </span>
  );
}
