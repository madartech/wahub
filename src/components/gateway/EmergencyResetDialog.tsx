import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { gatewayService } from '@/services/gateway';
import { useQrPreparation } from '@/hooks/useQrPreparation';
import QrDebugSummary from '@/components/operations/dialogs/QrDebugSummary';
import { AlertTriangle, Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface EmergencyResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
  onSuccess?: () => void;
}

type ResetPhase = 'confirm' | 'resetting' | 'qr' | 'failed';

export default function EmergencyResetDialog({ open, onOpenChange, userId, userName, onSuccess }: EmergencyResetDialogProps) {
  const [phase, setPhase] = useState<ResetPhase>('confirm');
  const [statusLogs, setStatusLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayName = userName || userId;
  const loggedRef = useRef({ qr: false, connected: false });

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setStatusLogs(prev => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  }, []);

  const qr = useQrPreparation({
    userId,
    active: open && phase === 'qr',
    onConnected: () => {
      if (loggedRef.current.connected) return;
      loggedRef.current.connected = true;
      addLog('✅ WhatsApp connected!');
      onSuccess?.();
    },
    onQrLoaded: () => {
      if (loggedRef.current.qr) return;
      loggedRef.current.qr = true;
      addLog('✅ QR code displayed');
    },
  });

  useEffect(() => {
    if (phase === 'qr' && qr.expired) addLog('❌ QR preparation window expired');
  }, [phase, qr.expired, addLog]);

  const handleClose = () => {
    setPhase('confirm');
    setStatusLogs([]);
    setErrorMessage(null);
    loggedRef.current = { qr: false, connected: false };
    onOpenChange(false);
  };

  const handleConfirmReset = async () => {
    setPhase('resetting');
    setStatusLogs([]);
    setErrorMessage(null);
    loggedRef.current = { qr: false, connected: false };
    addLog('🔄 Starting reset...');

    try {
      addLog('📡 Calling reset-session endpoint...');
      const op = await gatewayService.resetSession(userId);
      if (!op.ok) {
        throw new Error(op.error || 'reset-session failed');
      }
      addLog('✅ Reset-session call successful (container removed, session wiped, reprovisioned)');
      addLog('⏳ Preparing QR…');
      setPhase('qr');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setPhase('failed');
      setErrorMessage(msg);
      addLog(`❌ Reset error: ${msg}`);
    }
  };

  const handleRetry = () => {
    handleConfirmReset();
  };

  const isRunning = phase === 'resetting' || (phase === 'qr' && !qr.connected);


  if (phase === 'confirm') {
    return (
      <AlertDialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p className="font-semibold text-destructive">
                ⚠️ This will log out the current linked device for <strong>{displayName}</strong> and require scanning a new QR.
              </p>
              <p>
                Sending will stop until a new QR code is scanned and the session is re-established.
              </p>
              <p>
                Only proceed if you need to re-link WhatsApp to a different device.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Reset Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reset + Reconnect
          </DialogTitle>
          <DialogDescription>
            Resetting WhatsApp session for <strong>{displayName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isRunning && (
            <>
              <div className="flex items-center gap-2">
                {!qr.dataUrl && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                <span className="font-medium">
                  {phase === 'resetting' && 'Resetting...'}
                  {phase === 'qr' && (qr.dataUrl ? 'Scan QR Code Now' : qr.waitingMessage)}
                </span>
              </div>

              {!qr.dataUrl && !qr.expired && qr.lastResult && (
                <p className="text-xs text-muted-foreground">Attempt {qr.lastResult.retryCount}</p>
              )}

              {!qr.dataUrl && qr.slow && (
                <p className="text-sm text-muted-foreground">{qr.slowMessage}</p>
              )}

              {qr.dataUrl && (
                <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-white">
                  <img
                    src={qr.dataUrl}
                    alt="WhatsApp QR Code"
                    className="w-full max-w-[256px] aspect-square rounded-lg border"
                  />
                  <p className="text-sm text-center text-muted-foreground">
                    WhatsApp → Linked Devices → Link a device
                  </p>
                </div>
              )}

              {phase === 'qr' && qr.expired && !qr.refreshing && (
                <p className="text-sm text-destructive">{qr.error || 'QR was not ready in time.'}</p>
              )}

              {!qr.dataUrl && <QrDebugSummary result={qr.lastResult} />}

              <div className="flex gap-2">
                {phase === 'qr' && (
                  <Button
                    variant="outline"
                    onClick={() => void qr.refresh()}
                    disabled={qr.refreshing}
                    className="flex-1"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${qr.refreshing ? 'animate-spin' : ''}`} />
                    Refresh QR
                  </Button>
                )}
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
              </div>
            </>
          )}

          {phase === 'qr' && qr.connected && (
            <>
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">WhatsApp Connected!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Session is now active and ready for messaging.
              </p>
              <Button variant="outline" onClick={handleClose} className="w-full">
                Close
              </Button>
            </>
          )}


          {phase === 'failed' && (
            <>
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Reset Failed</span>
              </div>
              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleRetry} className="flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Reset
                </Button>
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
              </div>
            </>
          )}

          {statusLogs.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Status Log:</p>
              <div className="max-h-32 overflow-y-auto rounded bg-muted p-2 space-y-0.5">
                {statusLogs.map((log, i) => (
                  <p key={i} className="text-xs font-mono text-muted-foreground">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
