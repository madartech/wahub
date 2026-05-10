import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { toast } from '@/hooks/use-toast';
import ErrorDetail from '@/components/operations/ErrorDetail';
import { OperationResponse } from '@/types/gateway';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  userName: string;
}

export default function TestSendDialog({ open, onOpenChange, userId, userName }: Props) {
  const [to, setTo] = useState('');
  const [text, setText] = useState('Test from WA Hub');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OperationResponse | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setResult(null);
    const res = await gatewayService.adminTestSend(userId, {
      to: to.replace(/\D/g, ''),
      text,
    });
    setLoading(false);
    setResult(res);
    if (res.ok) {
      toast({ title: 'Message sent', description: `Sent to ${to}` });
    } else {
      const detail = res.detail as any;
      const status = detail?.waha?.status || detail?.status;
      toast({
        title: 'Send failed',
        description: status === 'STARTING'
          ? 'WAHA still starting — try Restart Instance.'
          : (res.error || 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Test send</DialogTitle>
          <DialogDescription>Send a test WhatsApp message via <strong>{userName}</strong>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ts-to">To (phone, digits only)</Label>
            <Input id="ts-to" value={to} onChange={e => setTo(e.target.value)} placeholder="9715XXXXXXXX" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ts-text">Message</Label>
            <Textarea id="ts-text" rows={3} value={text} onChange={e => setText(e.target.value)} />
          </div>
          <ErrorDetail result={result} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSend} disabled={loading || !to || !text}>
            {loading ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
