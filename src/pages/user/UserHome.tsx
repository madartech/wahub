import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappService } from '@/services/api';
import { SessionStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Copy, Key, Wifi, WifiOff, QrCode, Loader2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function UserHome() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SessionStatus>('offline');
  const [isLoading, setIsLoading] = useState(true);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (user?.apiKey) {
      try {
        const currentStatus = await whatsappService.getStatus(user.apiKey);
        setStatus(currentStatus);
        
        // Close modal if connected
        if (currentStatus === 'online' && qrModalOpen) {
          setQrModalOpen(false);
          setQrCode(null);
          toast.success('WhatsApp connected successfully!');
        }
      } catch (error) {
        console.error('Failed to fetch status');
      } finally {
        setIsLoading(false);
      }
    }
  }, [user?.apiKey, qrModalOpen]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleConnectWhatsApp = async () => {
    if (!user?.apiKey) return;
    
    setIsConnecting(true);
    try {
      const response = await whatsappService.getQRCode(user.apiKey);
      
      if (response.status === 'already_connected') {
        toast.success('WhatsApp is already connected!');
        setStatus('online');
      } else if (response.qr) {
        setQrCode(response.qr);
        setQrModalOpen(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get QR code';
      toast.error(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const copyApiKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      toast.success('API key copied to clipboard');
    }
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'online':
        return {
          icon: <Wifi className="w-8 h-8 text-success" />,
          badge: <Badge variant="online" className="text-sm">Connected</Badge>,
          message: 'Your WhatsApp is connected and ready to send messages.',
        };
      case 'qr_pending':
        return {
          icon: <QrCode className="w-8 h-8 text-warning animate-pulse-soft" />,
          badge: <Badge variant="pending" className="text-sm">QR Required</Badge>,
          message: 'Please scan the QR code to connect your WhatsApp.',
        };
      default:
        return {
          icon: <WifiOff className="w-8 h-8 text-muted-foreground" />,
          badge: <Badge variant="offline" className="text-sm">Disconnected</Badge>,
          message: 'Your WhatsApp is disconnected. Click Connect to re-login.',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.username}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* API Key Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Your API Key
              </CardTitle>
              <CardDescription>
                Use this key to authenticate your API requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-sm font-mono overflow-hidden text-ellipsis">
                  {user?.apiKey}
                </code>
                <Button variant="outline" size="icon" onClick={copyApiKey}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                WhatsApp Status
              </CardTitle>
              <CardDescription>
                Current connection status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {statusInfo.icon}
                    <div>
                      {statusInfo.badge}
                      <p className="text-sm text-muted-foreground mt-1">
                        {statusInfo.message}
                      </p>
                    </div>
                  </div>
                  {status === 'online' ? (
                    <div className="flex items-center gap-2 text-success">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Connected ✓</span>
                    </div>
                  ) : (
                    <Button 
                      className="w-full" 
                      onClick={handleConnectWhatsApp}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4 mr-2" />
                      )}
                      Connect WhatsApp
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you can perform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex flex-col gap-2"
                onClick={handleConnectWhatsApp}
                disabled={isConnecting || status === 'online'}
              >
                <QrCode className="w-6 h-6" />
                <span>{status === 'online' ? 'Connected' : 'Scan QR Code'}</span>
              </Button>
              <Link to="/user/send">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <Wifi className="w-6 h-6" />
                  <span>Send Message</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col gap-2"
                onClick={copyApiKey}
              >
                <Key className="w-6 h-6" />
                <span>Copy API Key</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Scan QR Code
            </DialogTitle>
            <DialogDescription>
              Open WhatsApp on your phone and scan this QR code to connect.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {qrCode ? (
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={qrCode} size={256} level="M" />
              </div>
            ) : (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Waiting for connection...
              <br />
              <span className="text-xs">Auto-checking every 3 seconds</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}