import { useState, useEffect } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmWord: string; // e.g. "REMOVE" or "RESET"
  onConfirm: () => void;
  loading?: boolean;
}

export default function ConfirmTypedDialog({ open, onOpenChange, title, description, confirmWord, onConfirm, loading }: Props) {
  const [val, setVal] = useState('');
  useEffect(() => { if (!open) setVal(''); }, [open]);
  const matches = val.trim() === confirmWord;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-word">
            Type <code className="rounded bg-muted px-1 font-mono">{confirmWord}</code> to confirm
          </Label>
          <Input
            id="confirm-word"
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder={confirmWord}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || loading}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Working…' : `Yes, ${confirmWord}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
