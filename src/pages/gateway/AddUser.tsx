import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { gatewayService } from '@/services/gateway';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Eye, EyeOff, Loader2, QrCode, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function AddUser() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userName, setUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Created user state
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  // Provisioning state
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
  };

  const handleCreateUser = async () => {
    if (!userName.trim()) {
      setError('Please enter a user name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await gatewayService.createUser(userName.trim());
      setCreatedUserId(result.id);
      setCreatedToken(result.token);
      setGatewayUrl(result.gatewayUrl);
      toast({
        title: 'User created',
        description: `${result.name} has been created successfully`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleProvision = async () => {
    if (!createdUserId) return;

    setIsProvisioning(true);
    setError(null);

    try {
      await gatewayService.provisionUser(createdUserId);
      setIsProvisioned(true);
      
      // Get QR code
      setIsLoadingQR(true);
      const qrResult = await gatewayService.getQRCode(createdUserId);
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
    if (!createdUserId) return;

    setIsLoadingQR(true);
    setError(null);

    try {
      const qrResult = await gatewayService.getQRCode(createdUserId);
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

  const handleDone = () => {
    navigate('/users');
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return '***********';
    return `${token.slice(0, 6)}${'*'.repeat(Math.min(token.length - 6, 20))}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add WhatsApp User</h1>
        <p className="text-muted-foreground">Create and provision a new WhatsApp user</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step 1: Create User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                1
              </span>
              Create User
            </CardTitle>
            <CardDescription>Enter the user's name to create their gateway account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">User Name</Label>
              <Input
                id="name"
                placeholder="e.g., John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={!!createdUserId || isCreating}
              />
            </div>

            {!createdUserId && (
              <Button 
                onClick={handleCreateUser} 
                disabled={isCreating || !userName.trim()}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </Button>
            )}

            {createdUserId && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">User created successfully</span>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Gateway Token</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono overflow-hidden text-ellipsis">
                      {showToken ? createdToken : maskToken(createdToken || '')}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(createdToken || '', 'Token')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Gateway URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                      {gatewayUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(gatewayUrl || '', 'Gateway URL')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Provision & QR */}
        <Card className={!createdUserId ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                2
              </span>
              Provision & Link WhatsApp
            </CardTitle>
            <CardDescription>Create the WhatsApp instance and scan the QR code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isProvisioned && (
              <Button 
                onClick={handleProvision} 
                disabled={!createdUserId || isProvisioning}
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

            {isProvisioned && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Instance provisioned</span>
                </div>

                {/* QR Code Display */}
                <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-muted/30">
                  {isLoadingQR ? (
                    <div className="flex items-center justify-center h-64 w-64">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="WhatsApp QR Code" 
                      className="h-64 w-64 rounded-lg border bg-white"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 w-64 text-muted-foreground">
                      No QR code available
                    </div>
                  )}

                  <p className="text-sm text-center text-muted-foreground">
                    Scan this QR in WhatsApp → Linked devices → Link a device
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleRefreshQR}
                    disabled={isLoadingQR}
                    className="flex-1"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingQR ? 'animate-spin' : ''}`} />
                    Refresh QR
                  </Button>
                  <Button onClick={handleDone} className="flex-1">
                    Done
                  </Button>
                </div>
              </div>
            )}

            {!createdUserId && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Create a user first to enable provisioning
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
