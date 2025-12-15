import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { gatewayService } from '@/services/gateway';
import { GatewayUser, SendMessageResponse } from '@/types/gateway';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Eye, EyeOff, Send, Loader2 } from 'lucide-react';

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<GatewayUser | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<SendMessageResponse | null>(null);

  useEffect(() => {
    if (id) {
      const foundUser = gatewayService.getUserById(id);
      if (foundUser) {
        setUser(foundUser);
      } else {
        navigate('/users');
      }
    }
  }, [id, navigate]);

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
  };

  const handleSendMessage = async () => {
    if (!user) return;

    // Clean phone number: allow + but strip it, keep only digits
    const cleanPhone = phoneNumber.replace(/\+/g, '').replace(/\D/g, '');
    
    if (!cleanPhone) {
      toast({
        title: 'Error',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setResponse(null);

    try {
      const result = await gatewayService.sendMessage(user.token, {
        to: cleanPhone,
        text: message.trim(),
      });

      setResponse(result);
      toast({
        title: 'Message sent',
        description: 'Your test message was sent successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setResponse({ ok: false, error: errorMessage });
      toast({
        title: 'Failed to send',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gatewayUrl = gatewayService.getGatewayUrl();
  const maskedToken = `${user.token.slice(0, 6)}${'*'.repeat(10)}`;

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
        <p className="text-muted-foreground">User details and test messaging</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Gateway credentials and endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">User Name</Label>
              <div className="font-medium">{user.name}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">WhatsApp Instance</Label>
              <div>
                <code className="rounded bg-muted px-2 py-1 text-sm">{user.instance}</code>
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
                  onClick={() => handleCopy(gatewayUrl, 'Gateway URL')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Gateway Token</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {showToken ? user.token : maskedToken}
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
                  onClick={() => handleCopy(user.token, 'Token')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Send Test Message Card */}
        <Card>
          <CardHeader>
            <CardTitle>Send Test Message</CardTitle>
            <CardDescription>Test the gateway by sending a WhatsApp message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">To (Phone Number)</Label>
              <Input
                id="phone"
                placeholder="e.g., 968XXXXXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground">
                Enter digits with country code (+ will be stripped)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your test message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                disabled={isSending}
              />
            </div>

            <Button 
              onClick={handleSendMessage} 
              disabled={isSending}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </>
              )}
            </Button>

            {response && (
              <div className={`rounded-lg border p-4 ${
                response.ok 
                  ? 'border-success/50 bg-success/10' 
                  : 'border-destructive/50 bg-destructive/10'
              }`}>
                <div className="text-sm font-medium mb-2">
                  {response.ok ? '✓ Success' : '✗ Error'}
                </div>
                <pre className="text-xs overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
