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

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 90000; // 90 seconds

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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTimeRef = useRef<number>(0);

  // QR state
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (qrPollingRef.current) clearTimeout(qrPollingRef.current);
    };
  }, []);

  // Fetch user status - single source of truth
  const fetchStatus = useCallback(async (userId: string) => {
    const result = await gatewayService.getUserStatus(userId);
    if (result.ok && result.session) {
      setSessionStatus(result.session.status);
      if (result.phoneNumber) {
        setPhoneNumber(result.phoneNumber);
      }
      return result.session.status;
    }
    // On error, set to UNKNOWN
    setSessionStatus('UNKNOWN');
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
          // Fetch live status
          await fetchStatus(id);
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

  // Poll status until it reaches target state or timeout
  const pollStatus = useCallback(async (userId: string, targetStates: SessionStatus[]) => {
    const elapsed = Date.now() - pollStartTimeRef.current;
    if (elapsed >= MAX_POLL_TIME) {
      setIsProvisioning(false);
      toast({
        title: 'Timeout',
        description: 'Provisioning took too long. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const status = await fetchStatus(userId);
    if (targetStates.includes(status)) {
      setIsProvisioning(false);
      if (status === 'SCAN_QR_CODE') {
        // Auto-open QR modal
        handleOpenQrModal();
      } else if (status === 'WORKING' || status === 'READY') {
        toast({
          title: 'Connected',
          description: 'WhatsApp is now connected!',
        });
      }
      return;
    }

    // Continue polling
    pollingRef.current = setTimeout(() => pollStatus(userId, targetStates), POLL_INTERVAL);
  }, [fetchStatus, toast]);

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

      // Start polling for status change
      pollStartTimeRef.current = Date.now();
      pollingRef.current = setTimeout(
        () => pollStatus(id, ['SCAN_QR_CODE', 'WORKING', 'READY']), 
        POLL_INTERVAL
      );

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to provision user';
      setError(errorMessage);
      setIsProvisioning(false);
    }
  };

  // QR polling - check if status becomes WORKING/READY
  const pollQrStatus = useCallback(async (userId: string) => {
    const status = await fetchStatus(userId);
    if (status === 'WORKING' || status === 'READY') {
      // Connected! Close modal
      setShowQrModal(false);
      setQrDataUrl(null);
      toast({
        title: 'Connected',
        description: 'WhatsApp is now connected!',
      });
      return;
    }

    if (status === 'SCAN_QR_CODE') {
      // Still waiting for scan, continue polling
      qrPollingRef.current = setTimeout(() => pollQrStatus(userId), POLL_INTERVAL);
    } else {
      // Status changed to something else, close modal
      setShowQrModal(false);
      setQrDataUrl(null);
    }
  }, [fetchStatus, toast]);

  const handleOpenQrModal = async () => {
    if (!id) return;

    setShowQrModal(true);
    setIsLoadingQR(true);
    setQrError(null);
    setQrDataUrl(null);

    try {
      const qrResult = await gatewayService.getQRCode(id);
      
      if (qrResult.alreadyConnected) {
        // Already connected, refresh status and close
        await fetchStatus(id);
        setShowQrModal(false);
        toast({
          title: 'Already Connected',
          description: 'WhatsApp is already connected.',
        });
        return;
      }

      if (!qrResult.ok || !qrResult.dataUrl) {
        setQrError(qrResult.error || 'QR not available');
        return;
      }

      setQrDataUrl(qrResult.dataUrl);

      // Start polling for connection
      qrPollingRef.current = setTimeout(() => pollQrStatus(id), POLL_INTERVAL);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get QR code';
      setQrError(errorMessage);
    } finally {
      setIsLoadingQR(false);
    }
  };

  const handleCloseQrModal = () => {
    if (qrPollingRef.current) {
      clearTimeout(qrPollingRef.current);
      qrPollingRef.current = null;
    }
    setShowQrModal(false);
    setQrDataUrl(null);
    setQrError(null);
  };

  const handleRefreshQR = async () => {
    if (!id) return;

    // Clear existing polling
    if (qrPollingRef.current) {
      clearTimeout(qrPollingRef.current);
      qrPollingRef.current = null;
    }

    setIsLoadingQR(true);
    setQrError(null);

    try {
      const qrResult = await gatewayService.getQRCode(id);
      
      if (qrResult.alreadyConnected) {
        await fetchStatus(id);
        setShowQrModal(false);
        toast({
          title: 'Already Connected',
          description: 'WhatsApp is already connected.',
        });
        return;
      }

      if (!qrResult.ok || !qrResult.dataUrl) {
        setQrError(qrResult.error || 'QR not available');
        return;
      }

      setQrDataUrl(qrResult.dataUrl);

      // Resume polling
      qrPollingRef.current = setTimeout(() => pollQrStatus(id), POLL_INTERVAL);

      toast({
        title: 'QR Refreshed',
        description: 'New QR code generated',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh QR';
      setQrError(errorMessage);
    } finally {
      setIsLoadingQR(false);
    }
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

            {/* Scan QR Button - only when status is SCAN_QR_CODE */}
            {showScanQrButton && (
              <Button 
                onClick={handleOpenQrModal}
                className="w-full h-12 text-base min-h-[44px]"
              >
                <QrCode className="mr-2 h-5 w-5" />
                Scan QR Code
              </Button>
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
                {isLoadingQR ? (
                  <div className="flex items-center justify-center h-48 w-48 sm:h-64 sm:w-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : qrError ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">{qrError}</p>
                  </div>
                ) : qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="WhatsApp QR Code" 
                    className="w-full max-w-[256px] aspect-square rounded-lg border bg-white"
                  />
                ) : null}

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
    </div>
  );
}
