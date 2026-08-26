import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { gatewayService } from '@/services/gateway';
import { GatewayUser, getConnectionState, SessionStatus, UserConnectionState } from '@/types/gateway';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Loader2, QrCode, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, Send, Phone, Key, Unplug, RotateCcw, Smartphone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import EmergencyResetDialog from '@/components/gateway/EmergencyResetDialog';
import PairingCodeDialog from '@/components/operations/dialogs/PairingCodeDialog';
import { statusCache } from '@/services/statusCache';


const POLL_INTERVAL = 3000; // 3 seconds
const QR_RETRY_INTERVAL = 3000; // retry /qr-base64 every 3s
const QR_RETRY_MAX_MS = 120000; // allow slow WEBJS/Chromium startup

interface QrResultSummary {
  ok: boolean;
  status?: SessionStatus;
  error?: string;
  hasDataUrl: boolean;
}


const DISPLAY_NAMES_KEY = 'gateway_user_display_names';

function getStoredDisplayName(userId: string): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(DISPLAY_NAMES_KEY) || '{}');
    return stored[userId] || null;
  } catch {
    return null;
  }
}

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<GatewayUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session status state - single source of truth
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('UNKNOWN');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  // Derive connection state from session status
  const connectionState = getConnectionState(sessionStatus);

  // Status refresh state
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  // Provisioning state
  const [isProvisioning, setIsProvisioning] = useState(false);

  // QR state
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrRetryTokenRef = useRef(0);
  const qrFlowActiveRef = useRef(false);
  const validQrLoadedRef = useRef(false);
  const [qrWaitMsg, setQrWaitMsg] = useState<string | null>(null);
  const [lastQrResult, setLastQrResult] = useState<QrResultSummary | null>(null);

  // Send test message state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Token reveal state
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isRevealingToken, setIsRevealingToken] = useState(false);

  // Disconnect state
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Reset dialog state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showPairDialog, setShowPairDialog] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (qrPollingRef.current) clearTimeout(qrPollingRef.current);
      if (qrRetryRef.current) clearTimeout(qrRetryRef.current);
    };
  }, []);

  // Fetch user status - single source of truth
  const fetchStatus = useCallback(async (userId: string) => {
    const result = await gatewayService.getUserStatus(userId);
    const nextStatus = result.ok && result.session ? result.session.status : 'UNKNOWN';

    setSessionStatus((currentStatus) => {
      // WEBJS can temporarily report UNKNOWN/STARTING while its status lookup
      // times out. Once the QR flow has reached SCAN_QR_CODE, only a real
      // terminal state may move the visible UI away from that state.
      if (
        qrFlowActiveRef.current &&
        currentStatus === 'SCAN_QR_CODE' &&
        nextStatus !== 'WORKING' &&
        nextStatus !== 'READY' &&
        (validQrLoadedRef.current || (nextStatus !== 'FAILED' && nextStatus !== 'STOPPED'))
      ) {
        return currentStatus;
      }
      return nextStatus;
    });

    if (result.ok && result.session) {
      if (result.phoneNumber) {
        setPhoneNumber(result.phoneNumber);
      }
      return nextStatus;
    }
    return 'UNKNOWN' as SessionStatus;
  }, []);

  // Fetch user data and status
  useEffect(() => {
    const fetchUser = async () => {
      if (!id) {
        navigate('/users');
        return;
      }

      setIsLoading(true);
      // Show last-known status immediately (from the Users list fan-out)
      const cached = statusCache.get(id);
      if (cached) setSessionStatus(cached);

      const result = await gatewayService.getUsers();

      if (result.ok) {
        const foundUser = result.users.find(u => u.id === id);
        if (foundUser) {
          // Apply stored display name if exists
          const storedName = getStoredDisplayName(id);
          setUser({
            ...foundUser,
            name: storedName || foundUser.name,
          });
          setIsLoading(false);
          // Live status is slow (gateway /status can take tens of seconds) —
          // fetch it in the background instead of blocking the page render.
          void fetchStatus(id).then((s) => { if (s) statusCache.set(id, s); });
          return;
        } else {
          setError('User not found');
        }
      } else {
        setError(result.error || 'Failed to load user');
      }
      setIsLoading(false);
    };

    fetchUser();

  }, [id, navigate, fetchStatus]);

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
  };

  const handleRevealToken = async () => {
    if (!id) return;
    setIsRevealingToken(true);
    try {
      const result = await gatewayService.getUserToken(id);
      setRevealedToken(result.token);
      setShowToken(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reveal token';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRevealingToken(false);
    }
  };

  const handleProvision = async () => {
    if (!id) return;

    setIsProvisioning(true);
    setError(null);

    try {
      const provisionResult = await gatewayService.provisionUser(id);

      // Update local user state with instance info
      setUser(prev => prev ? {
        ...prev,
        instanceId: provisionResult.instanceId,
        port: provisionResult.port,
      } : null);

      const st = provisionResult.status;
      if (st) {
        setSessionStatus(st);
        statusCache.set(id, st);
      }

      if (st === 'WORKING' || st === 'READY') {
        setIsProvisioning(false);
        toast({ title: 'Connected', description: 'WhatsApp is already connected.' });
        return;
      }

      setIsProvisioning(false);
      // A successful provision response is sufficient to open the QR flow.
      // /qr-base64, not the slower /status endpoint, decides QR visibility.
      qrFlowActiveRef.current = true;
      if (st === 'SCAN_QR_CODE') setSessionStatus('SCAN_QR_CODE');
      await handleOpenQrModal();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to provision user';
      setError(errorMessage);
      toast({ title: 'Provision failed', description: errorMessage, variant: 'destructive' });
      setIsProvisioning(false);
    }
  };


  // QR polling - check if status becomes WORKING/READY
  const pollQrStatus = useCallback(async (userId: string) => {
    const status = await fetchStatus(userId);
    if (status === 'WORKING' || status === 'READY') {
      qrFlowActiveRef.current = false;
      validQrLoadedRef.current = false;
      setShowQrModal(false);
      setQrDataUrl(null);
      toast({
        title: 'Connected',
        description: 'WhatsApp is now connected!',
      });
      return;
    }

    if (!validQrLoadedRef.current && (status === 'FAILED' || status === 'STOPPED')) {
      qrFlowActiveRef.current = false;
      setShowQrModal(false);
      setQrDataUrl(null);
      return;
    }

    // SCAN_QR_CODE, UNKNOWN, and transient STARTING are non-fatal while the
    // QR is displayed. Keep the panel open and preserve the previous UI.
    qrPollingRef.current = setTimeout(() => pollQrStatus(userId), POLL_INTERVAL);
  }, [fetchStatus, toast]);

  // Fetch the QR, retrying every 3s for up to 120s while WEBJS starts.
  const loadQrWithRetry = async (userId: string, deadline: number, token: number) => {
    try {
      const qrResult = await gatewayService.getQRCode(userId);
      console.log('[QR_BASE64_RESPONSE]', qrResult);
      if (token !== qrRetryTokenRef.current) return;

      const hasDataUrl = typeof qrResult.dataUrl === 'string' && qrResult.dataUrl.startsWith('data:image/');
      setLastQrResult({
        ok: qrResult.ok,
        status: qrResult.status,
        error: qrResult.error,
        hasDataUrl,
      });

      // The image payload is the source of truth. Commit it before inspecting
      // status/error fields so valid QR responses can never remain in waiting.
      if (hasDataUrl) {
        validQrLoadedRef.current = true;
        setQrDataUrl(qrResult.dataUrl ?? null);
        setQrError(null);
        setQrWaitMsg(null);
        setIsLoadingQR(false);
        setSessionStatus('SCAN_QR_CODE');
        statusCache.set(userId, 'SCAN_QR_CODE');
        if (qrPollingRef.current) clearTimeout(qrPollingRef.current);
        qrPollingRef.current = setTimeout(() => pollQrStatus(userId), POLL_INTERVAL);
        return;
      }

      if (qrResult.status === 'SCAN_QR_CODE') {
        setSessionStatus('SCAN_QR_CODE');
        statusCache.set(userId, 'SCAN_QR_CODE');
      } else if (
        qrResult.status === 'WORKING' ||
        qrResult.status === 'READY' ||
        qrResult.status === 'FAILED' ||
        qrResult.status === 'STOPPED'
      ) {
        setSessionStatus(qrResult.status);
        statusCache.set(userId, qrResult.status);
      }

      if (qrResult.alreadyConnected) {
        qrFlowActiveRef.current = false;
        setIsLoadingQR(false);
        setQrWaitMsg(null);
        setShowQrModal(false);
        toast({ title: 'Already Connected', description: 'WhatsApp is already connected.' });
        fetchStatus(userId);
        return;
      }

      if (Date.now() < deadline) {
        setQrWaitMsg('Waiting for QR…');
        qrRetryRef.current = setTimeout(
          () => loadQrWithRetry(userId, deadline, token),
          QR_RETRY_INTERVAL,
        );
        return;
      }

      setIsLoadingQR(false);
      setQrWaitMsg(null);
      setQrError(qrResult.error || 'QR was not ready after 120 seconds. Try Refresh QR.');
    } catch (err) {
      if (token !== qrRetryTokenRef.current) return;
      const isNetwork = err instanceof TypeError || /failed to fetch/i.test(String(err));
      if (Date.now() < deadline) {
        setQrWaitMsg(isNetwork ? 'Reconnecting to gateway…' : 'Waiting for QR…');
        qrRetryRef.current = setTimeout(
          () => loadQrWithRetry(userId, deadline, token),
          QR_RETRY_INTERVAL,
        );
        return;
      }
      setIsLoadingQR(false);
      setQrWaitMsg(null);
      setQrError(
        isNetwork
          ? 'Network/CORS error reaching gateway.walinkme.com. Please refresh the app.'
          : err instanceof Error ? err.message : 'Failed to get QR code',
      );
    }
  };

  const startQrLoad = (userId: string) => {
    if (qrRetryRef.current) clearTimeout(qrRetryRef.current);
    if (qrPollingRef.current) clearTimeout(qrPollingRef.current);
    qrFlowActiveRef.current = true;
    validQrLoadedRef.current = false;
    const token = ++qrRetryTokenRef.current;
    setIsLoadingQR(true);
    setQrError(null);
    setQrWaitMsg('Waiting for QR…');
    setQrDataUrl(null);
    setLastQrResult(null);
    loadQrWithRetry(userId, Date.now() + QR_RETRY_MAX_MS, token);
  };

  const handleOpenQrModal = async () => {
    if (!id) return;
    setShowQrModal(true);
    startQrLoad(id);
  };

  const handleCloseQrModal = () => {
    qrFlowActiveRef.current = false;
    validQrLoadedRef.current = false;
    qrRetryTokenRef.current++;
    if (qrPollingRef.current) {
      clearTimeout(qrPollingRef.current);
      qrPollingRef.current = null;
    }
    if (qrRetryRef.current) {
      clearTimeout(qrRetryRef.current);
      qrRetryRef.current = null;
    }
    setShowQrModal(false);
    setQrDataUrl(null);
    setQrError(null);
    setQrWaitMsg(null);
    setLastQrResult(null);
    setIsLoadingQR(false);
  };

  const handleRefreshQR = async () => {
    if (!id) return;
    startQrLoad(id);
  };

  const handleRefreshStatus = async () => {
    if (!id) return;

    setIsRefreshingStatus(true);
    try {
      const status = await fetchStatus(id);
      toast({
        title: 'Status Refreshed',
        description: `Status: ${status}${phoneNumber ? `, Phone: ${phoneNumber}` : ''}`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get status';
      toast({
        title: 'Status Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handleDisconnect = async () => {
    if (!id) return;
    setIsDisconnecting(true);
    try {
      const op = await gatewayService.stopInstance(id);
      if (!op.ok) throw new Error(op.error || 'Failed to disconnect');
      await fetchStatus(id);
      toast({
        title: 'Disconnected',
        description: 'WhatsApp session disconnected.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSendTestMessage = async () => {
    const phone = testPhone.replace(/\D/g, ''); // Strip non-digits
    
    if (!phone) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid phone number (digits only)',
        variant: 'destructive',
      });
      return;
    }
    
    if (!testMessage.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      // Get the user's token - use revealed token if available, otherwise fetch it
      let token = revealedToken;
      if (!token && id) {
        const tokenResult = await gatewayService.getUserToken(id);
        token = tokenResult.token;
      }
      
      if (!token) {
        throw new Error('Could not retrieve user token');
      }

      // Use the gateway send endpoint with Bearer token auth
      await gatewayService.sendMessage(token, {
        to: phone,
        text: testMessage.trim(),
      });
      
      toast({
        title: 'Message Sent',
        description: `Sent to ${phone}`,
      });
      setTestMessage('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      toast({
        title: 'Send Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Helper to get status badge
  const getStatusBadge = (state: UserConnectionState) => {
    switch (state) {
      case 'connected':
        return <Badge className="bg-success text-success-foreground">Connected</Badge>;
      case 'scan_qr':
        return <Badge className="bg-warning text-warning-foreground">Scan QR</Badge>;
      case 'provisioning':
        return <Badge variant="secondary">Provisioning...</Badge>;
      case 'not_provisioned':
      default:
        return <Badge variant="secondary">Not Provisioned</Badge>;
    }
  };

  // Determine button visibility based on connection state
  const showProvisionButton = connectionState === 'not_provisioned' && !isProvisioning;
  const showScanQrButton = connectionState === 'scan_qr' && !isProvisioning;
  const showConnectedInfo = connectionState === 'connected';
  const showSendTestMessage = connectionState === 'connected';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* User Info Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-48" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Provisioning Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'User not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
        <p className="text-muted-foreground">User details and provisioning</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>User details and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Name</Label>
              <div className="font-medium">{user.name}</div>
            </div>

            {(user.tokenMasked || revealedToken) && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Token</Label>
                <div className="flex items-center gap-2">
                  {revealedToken ? (
                    <>
                      <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                        {showToken ? revealedToken : '••••••••••••••••'}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(revealedToken, 'Token')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                        {user.tokenMasked}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRevealToken}
                        disabled={isRevealingToken}
                      >
                        {isRevealingToken ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-1" />
                            Reveal
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {phoneNumber && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{phoneNumber}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground">Status</Label>
              <div className="flex items-center gap-2">
                {getStatusBadge(connectionState)}
                <span className="text-xs text-muted-foreground">({sessionStatus})</span>
              </div>
            </div>

            {user.instanceId && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Instance ID</Label>
                <div>
                  <code className="rounded bg-muted px-2 py-1 text-sm">{user.instanceId}</code>
                </div>
              </div>
            )}

            {user.port && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Port</Label>
                <div>
                  <code className="rounded bg-muted px-2 py-1 text-sm">{user.port}</code>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground">Gateway URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {user.gatewayUrl || gatewayService.getGatewayUrl()}
                </code>
                <Button
                  variant="outline"
                  onClick={() => handleCopy(user.gatewayUrl || gatewayService.getGatewayUrl(), 'Gateway URL')}
                  className="h-11 min-h-[44px] px-3"
                >
                  <Copy className="h-4 w-4 mr-2 sm:mr-0" />
                  <span className="sm:hidden">Copy</span>
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleRefreshStatus}
              disabled={isRefreshingStatus}
              className="h-11 min-h-[44px] w-full sm:w-auto"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          </CardContent>
        </Card>

        {/* Provisioning Card */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Provisioning</CardTitle>
            <CardDescription>
              {showConnectedInfo 
                ? 'WhatsApp is connected' 
                : connectionState === 'scan_qr'
                ? 'Scan QR code to connect'
                : connectionState === 'provisioning' || isProvisioning
                ? 'Provisioning in progress...'
                : 'Provision WhatsApp instance'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provisioning Button - only when not provisioned */}
            {showProvisionButton && (
              <Button 
                onClick={handleProvision} 
                disabled={isProvisioning}
                className="w-full h-12 text-base min-h-[44px]"
              >
                <QrCode className="mr-2 h-5 w-5" />
                Provision & Generate QR
              </Button>
            )}

            {/* Provisioning in progress */}
            {(isProvisioning || connectionState === 'provisioning') && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Provisioning... please wait</span>
              </div>
            )}

            {/* Scan QR + Pairing Code Buttons - when status is SCAN_QR_CODE */}
            {showScanQrButton && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleOpenQrModal}
                  className="flex-1 h-12 text-base min-h-[44px]"
                >
                  <QrCode className="mr-2 h-5 w-5" />
                  Scan QR Code
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPairDialog(true)}
                  className="flex-1 h-12 text-base min-h-[44px]"
                >
                  <Smartphone className="mr-2 h-5 w-5" />
                  Generate Code
                </Button>
              </div>
            )}

            {/* Connected Info + Disconnect/Reset */}
            {showConnectedInfo && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">WhatsApp Connected</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="h-11 min-h-[44px] text-warning hover:text-warning border-warning/30"
                  >
                    {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                    Disconnect
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowResetDialog(true)}
                    className="h-11 min-h-[44px] text-destructive hover:text-destructive border-destructive/30"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset + Reconnect
                  </Button>
                </div>
              </div>
            )}

            {/* Reset button for non-connected states */}
            {!showConnectedInfo && !isProvisioning && connectionState !== 'provisioning' && (
              <Button 
                variant="outline" 
                onClick={() => setShowResetDialog(true)}
                className="h-11 min-h-[44px] text-destructive hover:text-destructive border-destructive/30 w-full sm:w-auto"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset + Reconnect
              </Button>
            )}

            {/* QR Modal */}
            {showQrModal && (
              <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-muted/30 max-h-[80vh] overflow-y-auto">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="WhatsApp QR Code" 
                    className="w-full max-w-[256px] aspect-square rounded-lg border bg-white"
                  />
                ) : isLoadingQR ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-48 w-48 sm:h-64 sm:w-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{qrWaitMsg || 'Loading…'}</p>
                  </div>
                ) : qrError ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">{qrError}</p>
                  </div>
                ) : null}

                {lastQrResult && !qrDataUrl && (
                  <div className="w-full text-center text-xs text-muted-foreground">
                    <p>
                      Last QR: ok={String(lastQrResult.ok)}, status={lastQrResult.status || 'none'}, error={lastQrResult.error || 'none'}, hasDataUrl={String(lastQrResult.hasDataUrl)}
                    </p>
                    {lastQrResult.hasDataUrl && (
                      <p className="mt-1 font-medium text-destructive">QR image received but was not rendered.</p>
                    )}
                  </div>
                )}

                <p className="text-sm text-center text-muted-foreground px-2">
                  Scan this QR in WhatsApp → Linked devices → Link a device
                </p>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={handleRefreshQR}
                    disabled={isLoadingQR}
                    className="h-11 min-h-[44px]"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingQR ? 'animate-spin' : ''}`} />
                    Refresh QR
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={handleCloseQrModal}
                    className="h-11 min-h-[44px]"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send Test Message Card - Only show when connected */}
        {showSendTestMessage && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Send Test Message</CardTitle>
              <CardDescription>Send a WhatsApp message using this user's token</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Phone (e.g. 966501234567)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="h-12 text-base"
                />
                <Textarea
                  placeholder="Message..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="min-h-[80px] max-h-32 text-base"
                  rows={2}
                />
                <Button
                  onClick={handleSendTestMessage}
                  disabled={isSending || !testPhone.trim() || !testMessage.trim()}
                  className="h-12 text-base min-h-[44px]"
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Send Test Message
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reset + Reconnect Dialog */}
      {id && (
        <EmergencyResetDialog
          open={showResetDialog}
          onOpenChange={setShowResetDialog}
          userId={id}
          userName={user.name}
          onSuccess={() => { if (id) fetchStatus(id); }}
        />
      )}

      {/* Pairing Code Dialog */}
      {id && (
        <PairingCodeDialog
          open={showPairDialog}
          onOpenChange={setShowPairDialog}
          userId={id}
          userName={user.name}
          onConnected={() => { if (id) fetchStatus(id); }}
        />
      )}
    </div>
  );
}
