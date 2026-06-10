import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Smartphone, Copy, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  userName: string;
  onConnected?: () => void;
}

const normalizePhone = (s: string) => s.replace(/[^\d]/g, '');

export default function PairingCodeDialog({ open, onOpenChange, userId, userName, onConnected }: Props) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [shownPhone, setShownPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [connected, setConnected] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);

  const clearPoll = useCallback(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  }, []);

  useEffect(() => {
    if (!open) {
      clearPoll();
      setCode(null); setError(null); setHint(null); setConnected(false); setCopied(false);
    }
  }, [open, clearPoll]);

  const startPolling = useCallback(() => {
    clearPoll();
    setPolling(true);
    pollStartRef.current = Date.now();
    pollRef.current = window.setInterval(async () => {
      if (Date.now() - pollStartRef.current > 90_000) { clearPoll(); return; }
      const s = await gatewayService.getUserStatus(userId);
      const st = s.session?.status;
      if (st === 'WORKING' || st === 'READY') {
        clearPoll();
        setConnected(true);
        onConnected?.();
      }
    }, 4000) as unknown as number;
  }, [userId, onConnected, clearPoll]);

  const handleGenerate = async () => {
    const clean = normalizePhone(phone);
    setError(null); setHint(null); setCode(null); setConnected(false);
    if (!clean || clean.length < 8) {
      setError('Enter a valid WhatsApp number (digits only, at least 8 digits).');
      return;
    }
    setLoading(true);
    const r = await gatewayService.getPairingCode(userId, clean);
    setLoading(false);
    if (!r.ok) {
      if (/missing_phone/i.test(r.error || '')) {
        setError('Enter the WhatsApp number first.');
      } else if (r.notProvisioned) {
        setError('This account may need provisioning first. Click Provision, then Generate Code again.');
      } else if (/pairing_code_failed/i.test(r.error || '')) {
        setError(r.detail || r.error || 'Pairing code failed.');
      } else {
        setError(r.error || 'Failed to get pairing code.');
        if (r.detail) setHint(r.detail);
      }
      return;
    }
    setCode(r.code || null);
    setShownPhone(r.phoneNumber || clean);
    startPolling();
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: 'Copied', description: code });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Link WhatsApp with Code — {userName}
          </DialogTitle>
          <DialogDescription>
            Get an 8-character code, then enter it on the customer's WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="wa-phone">WhatsApp Number</Label>
            <Input
              id="wa-phone"
              placeholder="968XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="off"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Include country code. Digits only — spaces and + are stripped.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div>{error}</div>
                {hint && <div className="text-xs opacity-80 mt-1 break-all">{hint}</div>}
              </div>
            </div>
          )}

          {code && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="text-xs text-muted-foreground text-center">
                Pairing code{shownPhone ? ` for ${shownPhone}` : ''}
              </div>
              <div className="text-center font-mono font-bold tracking-[0.3em] text-3xl select-all">
                {code}
              </div>
              <Button variant="outline" className="w-full" onClick={handleCopy}>
                {copied ? <CheckCircle className="mr-2 h-4 w-4 text-success" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copied' : 'Copy Code'}
              </Button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                On the customer's WhatsApp: <b>Linked devices</b> → <b>Link a device</b> →
                {' '}<b>Link with phone number instead</b> → enter this code.
              </p>
              {connected ? (
                <div className="flex items-center gap-2 text-success text-sm">
                  <CheckCircle className="h-4 w-4" /> Connected successfully.
                </div>
              ) : polling ? (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" /> Waiting for WhatsApp to confirm…
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Polling stopped. Click Refresh Status or generate a new code.</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {code ? 'Get New Code' : 'Get Pairing Code'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
