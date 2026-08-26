import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, QrCode, CheckCircle, AlertTriangle } from 'lucide-react';
import { useQrPreparation } from '@/hooks/useQrPreparation';
import QrDebugSummary from './QrDebugSummary';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  userName: string;
  onConnected?: () => void;
}

export default function QrDialog({ open, onOpenChange, userId, userName, onConnected }: Props) {
  const qr = useQrPreparation({ userId, active: open, onConnected });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Scan QR — {userName}</DialogTitle>
          <DialogDescription>
            {qr.dataUrl ? 'WhatsApp → Linked Devices → Link a device' : qr.waitingMessage}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {qr.dataUrl && (
            <img
              src={qr.dataUrl}
              alt="WhatsApp QR"
              className="w-full max-w-[256px] aspect-square rounded border bg-white"
            />
          )}

          {!qr.dataUrl && qr.connected && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" /> Connected
            </div>
          )}

          {!qr.dataUrl && !qr.connected && (qr.waiting || qr.refreshing) && (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{qr.waitingMessage}</p>
            </div>
          )}

          {!qr.dataUrl && !qr.connected && qr.expired && !qr.refreshing && (
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{qr.error || 'QR not available'}</p>
            </div>
          )}

          {!qr.dataUrl && <QrDebugSummary result={qr.lastResult} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void qr.refresh()} disabled={qr.refreshing}>
            <RefreshCw className={`mr-1 h-3 w-3 ${qr.refreshing ? 'animate-spin' : ''}`} /> Refresh QR
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
