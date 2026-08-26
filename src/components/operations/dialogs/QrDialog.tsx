import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, QrCode, CheckCircle, Power, AlertTriangle } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { isRetryableQRResponse, QRResponse, SessionStatus } from '@/types/gateway';
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

interface QrResultSummary {
  ok: boolean;
  status?: SessionStatus;
  error?: string;
  hasDataUrl: boolean;
}

export default function QrDialog({ open, onOpenChange, userId, userName, onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<QRResponse | null>(null);
  const [status, setStatus] = useState<SessionStatus | 'UNKNOWN'>('UNKNOWN');
  const [provisioning, setProvisioning] = useState(false);
  const [lastQrResult, setLastQrResult] = useState<QrResultSummary | null>(null);
  const startedAtRef = useRef<number>(0);
  const qrRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrRequestTokenRef = useRef(0);
  const validQrLoadedRef = useRef(false);
  const fetchQrRef = useRef<(restartWindow?: boolean) => Promise<void>>(async () => undefined);

  const fetchQR = useCallback(async (restartWindow = false) => {
    if (restartWindow) {
      startedAtRef.current = Date.now();
      qrRequestTokenRef.current += 1;
      if (qrRetryRef.current) clearTimeout(qrRetryRef.current);
      setQr(null);
      setLastQrResult(null);
      validQrLoadedRef.current = false;
    }
    const token = qrRequestTokenRef.current;
    setLoading(true);
    const r = await gatewayService.getQRCode(userId);
    console.log('[QR_BASE64_RESPONSE]', r);
    if (token !== qrRequestTokenRef.current) return;
    const hasDataUrl = typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:image/');
    setLastQrResult({ ok: r.ok, status: r.status, error: r.error, hasDataUrl });
    if (hasDataUrl) {
      // dataUrl is authoritative; render it before considering any metadata.
      validQrLoadedRef.current = true;
      setQr(r);
      setLoading(false);
      setStatus('SCAN_QR_CODE');
      return;
    } else if (r.status === 'WORKING' || r.status === 'READY') {
      setStatus(r.status);
    }
    const retryable = isRetryableQRResponse(r);
    if (!hasDataUrl && !r.alreadyConnected && Date.now() - startedAtRef.current < MAX_POLL_MS) {
      setQr(null);
      qrRetryRef.current = setTimeout(
        () => void fetchQrRef.current(),
        Math.max(POLL_MS, r.retryAfterMs || 0),
      );
      return;
    }
    if (retryable && !r.error) {
      r.error = 'QR was not ready after 120 seconds.';
    }
    setQr(r);
    setLoading(false);
  }, [userId]);
  fetchQrRef.current = fetchQR;

  useEffect(() => {
    if (!open) return;
    startedAtRef.current = Date.now();
    qrRequestTokenRef.current += 1;
    setQr(null);
    setLastQrResult(null);
    validQrLoadedRef.current = false;
    setStatus('UNKNOWN');
    void fetchQR();
    return () => {
      qrRequestTokenRef.current += 1;
      if (qrRetryRef.current) clearTimeout(qrRetryRef.current);
    };
  }, [open, fetchQR]);

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
          {loading && !qr?.dataUrl && (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Waiting for QR…</p>
            </div>
          )}

          {!loading && connected && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" /> Connected
            </div>
          )}

          {showQr && (
            <img
              src={qr?.dataUrl}
              alt="WhatsApp QR"
              className="w-full max-w-[256px] aspect-square rounded border bg-white"
            />
          )}

          {lastQrResult && !showQr && (
            <div className="text-center text-xs text-muted-foreground">
              <p>
                Last QR: ok={String(lastQrResult.ok)}, status={lastQrResult.status || 'none'}, error={lastQrResult.error || 'none'}, hasDataUrl={String(lastQrResult.hasDataUrl)}
              </p>
              {lastQrResult.hasDataUrl && (
                <p className="mt-1 font-medium text-destructive">QR image received but was not rendered.</p>
              )}
            </div>
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
