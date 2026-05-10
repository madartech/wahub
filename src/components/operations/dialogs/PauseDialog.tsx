import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PauseCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userName: string;
  onConfirm: (minutes: number) => void;
  loading?: boolean;
}

const PRESETS = [15, 30, 60, 240];

export default function PauseDialog({ open, onOpenChange, userName, onConfirm, loading }: Props) {
  const [minutes, setMinutes] = useState<number>(30);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PauseCircle className="h-5 w-5" /> Pause sending</DialogTitle>
          <DialogDescription>Pause outgoing messages for <strong>{userName}</strong>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button key={p} variant={minutes === p ? 'default' : 'outline'} size="sm" onClick={() => setMinutes(p)}>
                {p < 60 ? `${p}m` : `${p / 60}h`}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pause-min">Minutes</Label>
            <Input id="pause-min" type="number" min={1} max={43200}
              value={minutes} onChange={e => setMinutes(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={() => onConfirm(minutes)} disabled={loading || !minutes || minutes <= 0}>
            {loading ? 'Pausing…' : 'Pause'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
