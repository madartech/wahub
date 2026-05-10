import { GatewayUser } from '@/types/gateway';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import HealthBadge, { StatusBadge } from './HealthBadge';
import RowActions from './RowActions';

interface Props {
  users: GatewayUser[];
  onChanged: () => void;
  onModalChange: (open: boolean) => void;
}

function fmtTime(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function fmtCountdown(s?: string | null) {
  if (!s) return '—';
  const ms = new Date(s).getTime() - Date.now();
  if (ms <= 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function OperationsTable({ users, onChanged, onModalChange }: Props) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Instance</TableHead>
            <TableHead>Container</TableHead>
            <TableHead>Phone / Push</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Last activity</TableHead>
            <TableHead className="text-right">1m / 1h / 1d</TableHead>
            <TableHead>Paused</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u, i) => (
            <TableRow key={u.id}>
              <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <div className="font-medium">{u.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{u.id}</div>
              </TableCell>
              <TableCell className="font-mono text-xs">{u.instanceId || '—'}</TableCell>
              <TableCell className="font-mono text-xs">
                {u.containerName || (u.instanceId ? `waha_${u.instanceId}` : '—')}
              </TableCell>
              <TableCell className="text-xs">
                <div>{u.phoneNumber || u.me?.id || '—'}</div>
                <div className="text-muted-foreground">{u.pushName || u.me?.pushName || ''}</div>
              </TableCell>
              <TableCell><StatusBadge status={u.sessionStatus} /></TableCell>
              <TableCell><HealthBadge user={u} /></TableCell>
              <TableCell className="text-xs text-muted-foreground">{fmtTime(u.lastActivityAt)}</TableCell>
              <TableCell className="text-right text-xs font-mono">
                {(u.sendStats?.minute ?? 0)} / {(u.sendStats?.hour ?? 0)} / {(u.sendStats?.day ?? 0)}
              </TableCell>
              <TableCell className="text-xs">{fmtCountdown(u.pausedUntil)}</TableCell>
              <TableCell><RowActions user={u} onChanged={onChanged} onModalChange={onModalChange} /></TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                No instances match the current filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
