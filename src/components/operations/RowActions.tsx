import { useState, useRef, useEffect } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal, HeartPulse, QrCode, Power, RotateCw, Square, Play,
  Trash2, RefreshCcw, PauseCircle, PlayCircle, Send, FileText, Smartphone, Globe,
} from 'lucide-react';
import { GatewayUser, OperationResponse } from '@/types/gateway';
import { gatewayService } from '@/services/gateway';
import { toast } from '@/hooks/use-toast';
import ConfirmTypedDialog from './dialogs/ConfirmTypedDialog';
import PauseDialog from './dialogs/PauseDialog';
import TestSendDialog from './dialogs/TestSendDialog';
import LogsDialog from './dialogs/LogsDialog';
import QrDialog from './dialogs/QrDialog';
import PairingCodeDialog from './dialogs/PairingCodeDialog';
import ProxyDialog from './dialogs/ProxyDialog';

interface Props {
  user: GatewayUser;
  onChanged: () => void;
  onModalChange: (open: boolean) => void;
}

export default function RowActions({ user, onChanged, onModalChange }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [proxyOpen, setProxyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const failuresRef = useRef(0);

  const anyModal = confirmRemove || confirmReset || pauseOpen || testOpen || logsOpen || qrOpen || pairOpen || proxyOpen;
  useEffect(() => { onModalChange(anyModal); }, [anyModal, onModalChange]);

  const run = async (
    label: string,
    fn: () => Promise<OperationResponse>,
    opts?: { silentSuccess?: boolean; delayedRefresh?: boolean },
  ) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      failuresRef.current = 0;
      if (!opts?.silentSuccess) toast({ title: `${label} ✓`, description: user.name });
      onChanged();
      if (opts?.delayedRefresh) {
        setTimeout(() => onChanged(), 5000);
      }
    } else {
      failuresRef.current += 1;
      const detailStr = `${r.error || ''} ${JSON.stringify(r.detail || '')}`;
      const containerMissing = /no such container|container.*not.?found|missing/i.test(detailStr);
      toast({
        title: `${label} failed`,
        description: r.notDeployed
          ? 'Endpoint not deployed yet. Apply backend patch.'
          : containerMissing
            ? 'Container missing — try Provision / Create.'
            : `${r.error}${(r.detail as any)?.detail ? ' — ' + (r.detail as any).detail : ''}`,
        variant: 'destructive',
      });
      if (failuresRef.current >= 2) {
        toast({ title: 'Tip', description: 'Repeated failures — try Reset Session.' });
      }
    }
    return r;
  };

  const handleHealth = async () => {
    setBusy(true);
    const r = await gatewayService.getUserStatus(user.id);
    setBusy(false);
    toast({
      title: 'Health check',
      description: `Status: ${r.session?.status || 'UNKNOWN'}${r.phoneNumber ? ' • ' + r.phoneNumber : ''}`,
    });
    onChanged();
  };

  const handleProvision = async () => {
    setBusy(true);
    // Open the QR modal first so its shared polling window starts immediately.
    setQrOpen(true);
    try {
      await gatewayService.provisionUser(user.id);
      toast({ title: 'Provisioning started', description: user.name });
      onChanged();
      setTimeout(() => onChanged(), 5000);
    } catch (e) {
      toast({ title: 'Provision failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
    setBusy(false);
  };


  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy} className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover">
          <DropdownMenuLabel>Diagnostics</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleHealth}><HeartPulse className="mr-2 h-4 w-4" /> Health check</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQrOpen(true)}><QrCode className="mr-2 h-4 w-4" /> Get QR / Reconnect</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPairOpen(true)}><Smartphone className="mr-2 h-4 w-4" /> Generate Code</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLogsOpen(true)}><FileText className="mr-2 h-4 w-4" /> View logs</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTestOpen(true)}><Send className="mr-2 h-4 w-4" /> Test send</DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Container</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setProxyOpen(true)}><Globe className="mr-2 h-4 w-4" /> Proxy / egress IP…</DropdownMenuItem>
          <DropdownMenuItem onClick={handleProvision}><Power className="mr-2 h-4 w-4" /> Provision / Create</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('Restart', () => gatewayService.restartInstance(user.id), { delayedRefresh: true })}>
            <RotateCw className="mr-2 h-4 w-4" /> Restart
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('Stop', () => gatewayService.stopInstance(user.id))}>
            <Square className="mr-2 h-4 w-4" /> Stop
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('Start', () => gatewayService.startInstance(user.id))}>
            <Play className="mr-2 h-4 w-4" /> Start
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Sending</DropdownMenuLabel>
          {user.pausedUntil && new Date(user.pausedUntil).getTime() > Date.now() ? (
            <DropdownMenuItem onClick={() => run('Resume', () => gatewayService.resumeSending(user.id))}>
              <PlayCircle className="mr-2 h-4 w-4" /> Resume sending
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setPauseOpen(true)}>
              <PauseCircle className="mr-2 h-4 w-4" /> Pause sending…
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-destructive">Danger</DropdownMenuLabel>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmRemove(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Remove container…
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmReset(true)}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Reset session…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmTypedDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove container"
        description={`Removes the Docker container for ${user.name}. The user record and session folder are kept. You'll need to provision again to reconnect.`}
        confirmWord="REMOVE"
        loading={busy}
        onConfirm={async () => {
          await run('Remove container', () => gatewayService.removeContainer(user.id));
          setConfirmRemove(false);
        }}
      />

      <ConfirmTypedDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset session"
        description={`Stops & removes the container, deletes the session folder for ${user.name}, then re-provisions. WhatsApp will need a new QR scan.`}
        confirmWord="RESET"
        loading={busy}
        onConfirm={async () => {
          const r = await run('Reset session', () => gatewayService.resetSession(user.id), { delayedRefresh: true });
          setConfirmReset(false);
          if (r.ok) setQrOpen(true);
        }}
      />

      <PauseDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        userName={user.name}
        loading={busy}
        onConfirm={async (minutes) => {
          await run('Pause', () => gatewayService.pauseSending(user.id, minutes));
          setPauseOpen(false);
        }}
      />

      <TestSendDialog open={testOpen} onOpenChange={setTestOpen} userId={user.id} userName={user.name} />
      <LogsDialog open={logsOpen} onOpenChange={setLogsOpen} userId={user.id} userName={user.name} />
      <QrDialog open={qrOpen} onOpenChange={setQrOpen} userId={user.id} userName={user.name} onConnected={onChanged} />
      <PairingCodeDialog open={pairOpen} onOpenChange={setPairOpen} userId={user.id} userName={user.name} onConnected={onChanged} />
      <ProxyDialog open={proxyOpen} onOpenChange={setProxyOpen} user={user} onChanged={onChanged} />
    </>
  );
}
