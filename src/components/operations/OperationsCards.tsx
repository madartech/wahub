import { GatewayUser } from '@/types/gateway';
import { Card } from '@/components/ui/card';
import HealthBadge, { StatusBadge } from './HealthBadge';
import RowActions from './RowActions';

interface Props {
  users: GatewayUser[];
  onChanged: () => void;
  onModalChange: (open: boolean) => void;
}

export default function OperationsCards({ users, onChanged, onModalChange }: Props) {
  if (users.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No instances match.</p>;
  }
  return (
    <div className="space-y-3">
      {users.map((u, i) => (
        <Card key={u.id} className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">#{i + 1}</div>
              <div className="font-medium truncate">{u.name}</div>
              <div className="text-[10px] font-mono text-muted-foreground truncate">{u.instanceId || u.id}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <HealthBadge user={u} />
              <StatusBadge status={u.sessionStatus} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Phone</div>
              <div className="truncate">{u.phoneNumber || u.me?.id || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Push</div>
              <div className="truncate">{u.pushName || u.me?.pushName || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Sent 1m/1h/1d</div>
              <div className="font-mono">{(u.sendStats?.minute ?? 0)}/{(u.sendStats?.hour ?? 0)}/{(u.sendStats?.day ?? 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Container</div>
              <div className="font-mono truncate">{u.containerName || (u.instanceId ? `waha_${u.instanceId}` : '—')}</div>
            </div>
          </div>
          <div className="border-t pt-2">
            <WatchdogControls user={u} cfg={watchdogUsers?.[u.id]} onChanged={onChanged} compact />
          </div>
          <div className="flex justify-end">
            <RowActions user={u} onChanged={onChanged} onModalChange={onModalChange} />
          </div>
        </Card>
      ))}
    </div>
  );
}
