import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { gatewayService } from '@/services/gateway';
import { GatewayUser } from '@/types/gateway';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Loader2, QrCode, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, Send, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<GatewayUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status state
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  // Provisioning state
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);

  // Send test message state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

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
          setUser(foundUser);
        } else {
          setError('User not found');
        }
      } else {
        setError(result.error || 'Failed to load user');
      }
      setIsLoading(false);
    };

    fetchUser();
  }, [id, navigate]);

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
  };

  const handleProvision = async () => {
    if (!id) return;

    setIsProvisioning(true);
    setError(null);

    try {
      const provisionResult = await gatewayService.provisionUser(id);
      
      // Update local user state
      setUser(prev => prev ? {
        ...prev,
        provisioned: true,
        instanceId: provisionResult.instanceId,
        port: provisionResult.port,
      } : null);

      // Get QR code
      setIsLoadingQR(true);
      const qrResult = await gatewayService.getQRCode(id);
      setQrDataUrl(qrResult.dataUrl);

      toast({
        title: 'Provisioned',
        description: 'WhatsApp instance is ready. Scan the QR code.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to provision user';
      setError(errorMessage);
    } finally {
      setIsProvisioning(false);
      setIsLoadingQR(false);
    }
  };

  const handleRefreshQR = async () => {
    if (!id) return;

    setIsLoadingQR(true);
    setError(null);

    try {
      const qrResult = await gatewayService.getQRCode(id);
      setQrDataUrl(qrResult.dataUrl);
      toast({
        title: 'QR Refreshed',
        description: 'New QR code generated',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh QR';
      setError(errorMessage);
    } finally {
      setIsLoadingQR(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!id) return;

    setIsRefreshingStatus(true);
    try {
      const result = await gatewayService.getUserStatus(id);
      setUser(prev => prev ? { ...prev, phoneNumber: result.phoneNumber } : null);
      toast({
        title: 'Status Refreshed',
        description: result.phoneNumber ? `Phone: ${result.phoneNumber}` : 'No phone linked yet',
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

  const handleSendTestMessage = async () => {
    if (!id || !testPhone.trim() || !testMessage.trim()) return;

    setIsSending(true);
    try {
      const phone = testPhone.replace(/[^\d]/g, ''); // Strip non-digits
      await gatewayService.testSendMessage(id, {
        to: phone,
        text: testMessage,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

            {user.tokenMasked && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Token</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                    {user.tokenMasked}
                  </code>
                </div>
              </div>
            )}

            {user.phoneNumber && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{user.phoneNumber}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground">Provisioned</Label>
              <div>
                {user.provisioned ? (
                  <Badge className="bg-success text-success-foreground">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
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

            {user.gatewayUrl && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Gateway URL</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                    {user.gatewayUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(user.gatewayUrl || '', 'Gateway URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {user.provisioned && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshStatus}
                disabled={isRefreshingStatus}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Provisioning Card */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Provisioning</CardTitle>
            <CardDescription>
              {user.provisioned 
                ? 'Manage WhatsApp connection' 
                : 'Provision WhatsApp instance and scan QR'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user.provisioned && (
              <Button 
                onClick={handleProvision} 
                disabled={isProvisioning}
                className="w-full"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Provision & Generate QR
                  </>
                )}
              </Button>
            )}

            {(user.provisioned || qrDataUrl) && (
              <div className="space-y-4">
                {user.provisioned && !qrDataUrl && (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Instance provisioned</span>
                  </div>
                )}

                {/* QR Code Display */}
                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-muted/30">
                    {isLoadingQR ? (
                      <div className="flex items-center justify-center h-64 w-64">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <img 
                        src={qrDataUrl} 
                        alt="WhatsApp QR Code" 
                        className="h-64 w-64 rounded-lg border bg-white"
                      />
                    )}

                    <p className="text-sm text-center text-muted-foreground">
                      Scan this QR in WhatsApp → Linked devices → Link a device
                    </p>
                  </div>
                )}

                {user.provisioned && (
                  <Button 
                    variant="outline" 
                    onClick={handleRefreshQR}
                    disabled={isLoadingQR}
                    className="w-full"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingQR ? 'animate-spin' : ''}`} />
                    {qrDataUrl ? 'Refresh QR' : 'Get QR Code'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send Test Message Card */}
        {user.provisioned && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Send Test Message</CardTitle>
              <CardDescription>Send a WhatsApp message using this user's token</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Phone (e.g. 966501234567)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="sm:w-48"
                />
                <Textarea
                  placeholder="Message..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="flex-1 min-h-[40px] max-h-24"
                  rows={1}
                />
                <Button
                  onClick={handleSendTestMessage}
                  disabled={isSending || !testPhone.trim() || !testMessage.trim()}
                  className="sm:w-auto"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
