import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, RefreshCw, Loader2, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = 'https://api.madarivms.com';

export default function WhatsAppPairing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [countryCode, setCountryCode] = useState('968');
  const [nationalNumber, setNationalNumber] = useState('');

  const [authStatus, setAuthStatus] = useState<any>(null);
  const [pairingCode, setPairingCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isPolling, setIsPolling] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const apiKey = user?.apiKey || '';

  const fullPhoneNumber = useMemo(() => {
    const cc = (countryCode || '').replace(/\D/g, '');
    const nn = (nationalNumber || '').replace(/\D/g, '');
    if (!cc || !nn) return '';
    return cc + nn;
  }, [countryCode, nationalNumber]);

  async function apiFetch(path: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // not JSON
    }

    if (!res.ok) {
      const msg = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json ?? text;
  }

  async function getAuth() {
    setError('');
    try {
      const data = await apiFetch(`/api/${encodeURIComponent(apiKey)}/auth`, {
        method: 'GET',
      });
      setAuthStatus(data);
      return data;
    } catch (e: any) {
      setAuthStatus(null);
      setError(`Auth status failed: ${e.message}`);
      return null;
    }
  }

  async function requestPairingCode() {
    setError('');
    setPairingCode('');
    setBusy(true);
    try {
      if (!apiKey.trim()) throw new Error('API Key is required.');
      if (!fullPhoneNumber) throw new Error('Phone number is required.');

      const data = await apiFetch(
        `/api/${encodeURIComponent(apiKey)}/auth/request-pairing-code`,
        {
          method: 'POST',
          body: JSON.stringify({ phoneNumber: fullPhoneNumber }),
        }
      );

      setPairingCode(data?.pairingCode || '');
      await getAuth();
      
      toast({
        title: 'Pairing code generated',
        description: 'Enter this code in your WhatsApp app',
      });
    } catch (e: any) {
      setError(e.message);
      toast({
        title: 'Failed to get pairing code',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(() => {
      getAuth();
    }, 2000);
    setIsPolling(true);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }

  async function refreshNow() {
    setBusy(true);
    try {
      await getAuth();
    } finally {
      setBusy(false);
    }
  }

  async function copyPairingCode() {
    try {
      await navigator.clipboard.writeText(pairingCode);
      toast({
        title: 'Copied!',
        description: 'Pairing code copied to clipboard',
      });
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (apiKey) {
      refreshNow();
      startPolling();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const connected =
    authStatus?.status === 'connected' ||
    authStatus?.status === 'open' ||
    authStatus?.status === 'ready';

  // Redirect if connected
  useEffect(() => {
    if (connected) {
      toast({
        title: 'WhatsApp Connected!',
        description: 'Your WhatsApp is now linked',
      });
    }
  }, [connected]);

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Pairing</h1>
        <p className="text-muted-foreground">
          Link your WhatsApp account using phone number pairing
        </p>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Connection Status</CardTitle>
            <Badge variant={connected ? 'default' : 'secondary'}>
              {connected ? (
                <><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</>
              ) : (
                authStatus?.status || 'Unknown'
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshNow}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (isPolling ? stopPolling() : startPolling())}
            >
              {isPolling ? 'Stop Auto-Refresh' : 'Start Auto-Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pairing Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Request Pairing Code
          </CardTitle>
          <CardDescription>
            Enter your WhatsApp phone number to receive a pairing code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Country Code</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="968">Oman (+968)</SelectItem>
                  <SelectItem value="962">Jordan (+962)</SelectItem>
                  <SelectItem value="966">Saudi Arabia (+966)</SelectItem>
                  <SelectItem value="971">UAE (+971)</SelectItem>
                  <SelectItem value="974">Qatar (+974)</SelectItem>
                  <SelectItem value="973">Bahrain (+973)</SelectItem>
                  <SelectItem value="965">Kuwait (+965)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>WhatsApp Number</Label>
              <Input
                value={nationalNumber}
                onChange={(e) => setNationalNumber(e.target.value)}
                placeholder="9XXXXXXX"
                disabled={busy}
              />
            </div>
          </div>

          {fullPhoneNumber && (
            <p className="text-sm text-muted-foreground">
              Full number: +{fullPhoneNumber}
            </p>
          )}

          <Button
            onClick={requestPairingCode}
            disabled={busy || !fullPhoneNumber}
            className="w-full sm:w-auto"
          >
            {busy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting...</>
            ) : (
              'Request Pairing Code'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Pairing Code Display */}
      {pairingCode && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Your Pairing Code</CardTitle>
            <CardDescription>
              Enter this code in WhatsApp on your phone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-mono font-bold tracking-widest bg-muted px-4 py-3 rounded-lg">
                {pairingCode}
              </div>
              <Button variant="outline" size="icon" onClick={copyPairingCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">To link your WhatsApp:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open WhatsApp on your phone</li>
                <li>Go to Settings → Linked Devices</li>
                <li>Tap "Link a Device"</li>
                <li>Select "Link with phone number instead"</li>
                <li>Enter the pairing code above</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
