import { Fragment, useState } from 'react';
import { GatewayUser, WatchdogUserConfig } from '@/types/gateway';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import HealthBadge, { StatusBadge } from './HealthBadge';
import RowActions from './RowActions';
import WatchdogControls from './WatchdogControls';
import WatchdogBadges from './WatchdogBadges';

interface Props {
  users: GatewayUser[];
  watchdogUsers?: Record<string, WatchdogUserConfig>;
  onChanged: () => void;
  onModalChange: (open: boolean) => void;
}

function fmtTime(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function fmtRelative(s?: string | null) {
  if (!s) return '—';
  const ms = Date.now() - new Date(s).getTime();
  if (isNaN(ms) || ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtCountdown(s?: string | null) {
  if (!s) return '—';
  const ms = new Date(s).getTime() - Date.now();
  if (ms <= 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function OperationsTable({ users, watchdogUsers, onChanged, onModalChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageUsers = users.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="space-y-2">
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-20">Instance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageUsers.map((u, i) => {
            const isOpen = expanded.has(u.id);
            const cfg = watchdogUsers?.[u.id];
            return (
              <Fragment key={u.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => toggle(u.id)}
                >
                  <TableCell className="py-1.5">
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground">{startIdx + i + 1}</TableCell>
                  <TableCell className="py-1.5">
                    <div className="font-medium text-sm leading-tight">{u.name}</div>
                  </TableCell>
                  <TableCell className="py-1.5 font-mono text-xs">{u.instanceId || '—'}</TableCell>
                  <TableCell className="py-2"><StatusBadge status={u.sessionStatus} /></TableCell>
                  <TableCell className="py-2"><HealthBadge user={u} /></TableCell>
                  <TableCell className="py-2 text-xs">
                    {u.phoneNumber || u.me?.id || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {fmtRelative(u.lastActivityAt)}
                  </TableCell>
                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                    <RowActions user={u} onChanged={onChanged} onModalChange={onModalChange} />
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={8} className="py-3">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 px-2">
                        <Detail label="User ID" value={<span className="font-mono text-[11px] break-all">{u.id}</span>} />
                        <Detail label="Container" value={<span className="font-mono text-xs">{u.containerName || (u.instanceId ? `waha_${u.instanceId}` : '—')}</span>} />
                        <Detail label="Push name" value={<span className="text-xs">{u.pushName || u.me?.pushName || '—'}</span>} />
                        <Detail label="Last activity" value={<span className="text-xs">{fmtTime(u.lastActivityAt)}</span>} />
                        <Detail
                          label="Sends (1m / 1h / 1d)"
                          value={
                            <span className="font-mono text-xs">
                              {u.sendStats?.minute ?? 0} / {u.sendStats?.hour ?? 0} / {u.sendStats?.day ?? 0}
                            </span>
                          }
                        />
                        <Detail label="Paused" value={<span className="text-xs">{fmtCountdown(u.pausedUntil)}</span>} />
                        <Detail
                          label="Watchdog flags"
                          value={<WatchdogBadges user={u} cfg={cfg} />}
                        />
                        <Detail
                          label="Watchdog controls"
                          value={
                            <div onClick={(e) => e.stopPropagation()}>
                              <WatchdogControls user={u} cfg={cfg} onChanged={onChanged} compact />
                            </div>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                No instances match the current filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
