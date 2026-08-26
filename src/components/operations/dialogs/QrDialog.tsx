import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, QrCode, CheckCircle, Power, AlertTriangle } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { QRResponse, SessionStatus } from '@/types/gateway';
import { toast } from '@/hooks/use-toast';

const POLL_MS = 3000;
const MAX_POLL_MS = 120000;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  userName: string;
  onConnected?: () => void;
}

export default function QrDialog({ open, onOpenChange, userId, userName, onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<QRResponse | null>(null);
  const [status, setStatus] = useState<SessionStatus | 'UNKNOWN'>('UNKNOWN');
  const [provisioning, setProvisioning] = useState(false);
  const startedAtRef = useRef<number>(0);
  const qrRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrRequestTokenRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    const s = await gatewayService.getUserStatus(userId);
    const st = (s.session?.status || 'UNKNOWN') as SessionStatus | 'UNKNOWN';
    setStatus((current) => {
      if (
        current === 'SCAN_QR_CODE' &&
        st !== 'SCAN_QR_CODE' &&
        st !== 'WORKING' &&
        st !== 'READY' &&
        st !== 'FAILED' &&
        st !== 'STOPPED'
      ) {
        return current;
      }
      return st;
    });
    return st;
  }, [userId]);

  const fetchQR = useCallback(async (restartWindow = false) => {
    if (restartWindow) {
      startedAtRef.current = Date.now();
      qrRequestTokenRef.current += 1;
      if (qrRetryRef.current) clearTimeout(qrRetryRef.current);
      setQr(null);
    }
    const token = qrRequestTokenRef.current;
    setLoading(true);
    const r = await gatewayService.getQRCode(userId);
    if (token !== qrRequestTokenRef.current) return;
    if (r.status === 'SCAN_QR_CODE' || r.status === 'WORKING' || r.status === 'READY' || r.status === 'FAILED' || r.status === 'STOPPED') {
      setStatus(r.status);
    }
    if (!r.ok && Date.now() - startedAtRef.current < MAX_POLL_MS) {
      setQr(null);
      qrRetryRef.current = setTimeout(() => void fetchQR(), POLL_MS);
      return;
    }
    setQr(r);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    startedAtRef.current = Date.now();
    qrRequestTokenRef.current += 1;
    setQr(null);
    setStatus('UNKNOWN');
    void fetchQR();
    return () => {
      qrRequestTokenRef.current += 1;
      if (qrRetryRef.current) clearTimeout(qrRetryRef.current);
    };
  }, [open, fetchQR]);

  // Poll status every 3s for up to 120s while modal is open.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(async () => {
      if (Date.now() - startedAtRef.current > MAX_POLL_MS) {
        clearInterval(id);
        return;
      }
      const st = await fetchStatus();
      if (st === 'WORKING' || st === 'READY') {
        clearInterval(id);
        setQr({ ok: true, alreadyConnected: true, status: st as SessionStatus });
        onConnected?.();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [open, fetchStatus, onConnected]);

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      const p = await gatewayService.provisionUser(userId);
      toast({ title: 'Provisioned ✓', description: `${userName} — ${p.status || 'started'}` });
      startedAtRef.current = Date.now();
      if (p.status) setStatus(p.status);
      // Provision returned ok — open a fresh 120s QR retry window immediately.
      await fetchQR(true);
    } catch (e) {
      toast({
        title: 'Provision failed',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      });
    }
    setProvisioning(false);
  };


  const connected = status === 'WORKING' || status === 'READY' || !!qr?.alreadyConnected;
  const needsProvision = !connected && (status === 'STOPPED' || status === 'FAILED');
  const showQr = !connected && !!qr?.dataUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Scan QR — {userName}</DialogTitle>
          <DialogDescription>WhatsApp → Linked Devices → Link a device</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loading && connected && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" /> Connected
            </div>
          )}

          {!loading && showQr && (
            <img
              src={qr?.dataUrl}
              alt="WhatsApp QR"
              className="w-full max-w-[256px] aspect-square rounded border bg-white"
            />
          )}

          {!loading && !connected && !showQr && (
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">
                {qr?.error || 'QR not available'}{status !== 'UNKNOWN' ? ` (status: ${status})` : ''}
              </p>
            </div>
          )}

          {!loading && !connected && (
            <p className="text-xs text-muted-foreground">Waiting for scan… status: {status}</p>
          )}
        </div>
        <DialogFooter>
          {needsProvision && (
            <Button onClick={handleProvision} disabled={provisioning}>
              <Power className="mr-1 h-3 w-3" /> Provision / Reconnect
            </Button>
          )}
          {!connected && (
            <Button variant="outline" onClick={() => void fetchQR(true)} disabled={loading}>
              <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh QR
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
