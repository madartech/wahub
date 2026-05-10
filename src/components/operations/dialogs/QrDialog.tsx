import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, QrCode, CheckCircle } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { QRResponse } from '@/types/gateway';

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

  const fetchQR = useCallback(async () => {
    setLoading(true);
    const r = await gatewayService.getQRCode(userId);
    setLoading(false);
    setQr(r);
  }, [userId]);

  useEffect(() => { if (open) fetchQR(); }, [open, fetchQR]);

  // Poll status while QR shown
  useEffect(() => {
    if (!open) return;
    const id = setInterval(async () => {
      const s = await gatewayService.getUserStatus(userId);
      const status = s.session?.status;
      if (status === 'WORKING' || status === 'READY') {
        clearInterval(id);
        onConnected?.();
        onOpenChange(false);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [open, userId, onConnected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Scan QR — {userName}</DialogTitle>
          <DialogDescription>WhatsApp → Linked Devices → Link a device</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && qr?.alreadyConnected && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" /> Already connected
            </div>
          )}
          {!loading && qr?.dataUrl && (
            <img src={qr.dataUrl} alt="WhatsApp QR" className="w-full max-w-[256px] aspect-square rounded border bg-white" />
          )}
          {!loading && qr && !qr.ok && (
            <p className="text-sm text-destructive">QR not available: {qr.status || qr.error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fetchQR} disabled={loading}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
