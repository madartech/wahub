import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { SessionStatus } from '@/types/gateway';
import { AlertTriangle, Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 120000; // 120 seconds

interface EmergencyResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
  onSuccess?: () => void;
}

type ResetPhase = 'confirm' | 'resetting' | 'polling' | 'scan_qr' | 'connected' | 'failed';

export default function EmergencyResetDialog({ open, onOpenChange, userId, userName, onSuccess }: EmergencyResetDialogProps) {
  const [phase, setPhase] = useState<ResetPhase>('confirm');
  const [statusLogs, setStatusLogs] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number>(0);

  const displayName = userName || userId;

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setStatusLogs(prev => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  };

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    cleanup();
    setPhase('confirm');
    setStatusLogs([]);
    setQrDataUrl(null);
    setErrorMessage(null);
    setProgress(0);
  }, [cleanup]);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const pollStatus = useCallback(async () => {
    const elapsed = Date.now() - pollStartTimeRef.current;
    const progressPercent = Math.min((elapsed / MAX_POLL_TIME) * 100, 100);
    setProgress(progressPercent);

    if (elapsed >= MAX_POLL_TIME) {
      cleanup();
      setPhase('failed');
      setErrorMessage('Timeout: Polling exceeded 120 seconds');
      addLog('❌ Timeout reached');
      return;
    }

    try {
      const result = await gatewayService.getUserStatus(userId);
      const status = result.session?.status || 'UNKNOWN';
      addLog(`Status: ${status}`);

      if (status === 'SCAN_QR_CODE') {
        cleanup();
        setPhase('scan_qr');
        addLog('📱 Ready for QR scan - fetching QR code...');
        
        const qrResult = await gatewayService.getQRCode(userId);
        if (qrResult.ok && qrResult.dataUrl) {
          setQrDataUrl(qrResult.dataUrl);
          addLog('✅ QR code displayed');
          pollStartTimeRef.current = Date.now();
          pollingRef.current = setTimeout(pollStatus, POLL_INTERVAL);
        } else {
          setPhase('failed');
          setErrorMessage(qrResult.error || 'Failed to get QR code');
          addLog(`❌ QR error: ${qrResult.error}`);
        }
        return;
      }

      if (status === 'WORKING' || status === 'READY') {
        cleanup();
        setPhase('connected');
        setQrDataUrl(null);
        addLog('✅ WhatsApp connected!');
        onSuccess?.();
        return;
      }

      if (status === 'FAILED') {
        cleanup();
        setPhase('failed');
        setErrorMessage('Session failed');
        addLog('❌ Session failed');
        return;
      }

      pollingRef.current = setTimeout(pollStatus, POLL_INTERVAL);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`⚠️ Poll error: ${msg}`);
      pollingRef.current = setTimeout(pollStatus, POLL_INTERVAL);
    }
  }, [cleanup, userId, onSuccess]);

  const handleConfirmReset = async () => {
    cleanup();
    setPhase('resetting');
    setStatusLogs([]);
    setQrDataUrl(null);
    setErrorMessage(null);
    setProgress(0);
    addLog('🔄 Starting reset...');

    try {
      addLog('📡 Calling reset endpoint...');
      await gatewayService.resetUser(userId);
      addLog('✅ Reset call successful');
      
      setPhase('polling');
      pollStartTimeRef.current = Date.now();
      pollingRef.current = setTimeout(pollStatus, POLL_INTERVAL);
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

  const isRunning = phase === 'resetting' || phase === 'polling' || phase === 'scan_qr';

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
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">
                  {phase === 'resetting' && 'Resetting...'}
                  {phase === 'polling' && 'Waiting for QR ready...'}
                  {phase === 'scan_qr' && 'Scan QR Code Now'}
                </span>
              </div>

              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Polling for up to 120 seconds... ({Math.round(progress)}%)
              </p>

              {phase === 'scan_qr' && qrDataUrl && (
                <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-white">
                  <img 
                    src={qrDataUrl} 
                    alt="WhatsApp QR Code" 
                    className="w-full max-w-[256px] aspect-square rounded-lg border"
                  />
                  <p className="text-sm text-center text-muted-foreground">
                    WhatsApp → Linked Devices → Link a device
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full"
              >
                Cancel
              </Button>
            </>
          )}

          {phase === 'connected' && (
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
