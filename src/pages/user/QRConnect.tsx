import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappService } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, QrCode, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRConnect() {
  const { user } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const fetchQRCode = async () => {
    if (user?.apiKey) {
      setIsLoading(true);
      try {
        const response = await whatsappService.getQRCode(user.apiKey);
        
        if (response.status === 'already_connected') {
          setIsConnected(true);
          setQrCode(null);
        } else if (response.qr) {
          setQrCode(response.qr);
        }
        
        // Check status
        const status = await whatsappService.getStatus(user.apiKey);
        setIsConnected(status === 'online');
      } catch (error) {
        console.error('Failed to fetch QR code');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchQRCode();
  }, [user?.apiKey]);

  // Auto-refresh countdown
  useEffect(() => {
    if (isConnected) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchQRCode();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected, user?.apiKey]);

  if (isConnected) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <CardTitle className="text-2xl">Connected!</CardTitle>
              <CardDescription>
                Your WhatsApp is connected and ready to send messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Badge variant="online" className="text-sm">
                WhatsApp Connected
              </Badge>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Connect WhatsApp</CardTitle>
            <CardDescription>
              Scan this QR code with your WhatsApp mobile app to connect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden p-4">
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              ) : qrCode ? (
                <QRCodeSVG value={qrCode} size={256} level="M" />
              ) : (
                <p className="text-muted-foreground">Failed to load QR code</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Auto-refresh in {countdown}s</span>
              <Button variant="ghost" size="sm" onClick={fetchQRCode}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh now
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">How to connect:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Open WhatsApp on your phone</li>
                <li>Tap Menu or Settings</li>
                <li>Select "Linked Devices"</li>
                <li>Tap "Link a Device"</li>
                <li>Point your phone at this QR code</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
