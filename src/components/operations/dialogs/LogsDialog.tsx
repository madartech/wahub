import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, FileText } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { toast } from '@/hooks/use-toast';
import ErrorDetail from '@/components/operations/ErrorDetail';
import { LogsResponse } from '@/types/gateway';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  userName: string;
}

// Strip ANSI terminal color escape codes
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

export default function LogsDialog({ open, onOpenChange, userId, userName }: Props) {
  const [lines, setLines] = useState(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LogsResponse | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res = await gatewayService.getInstanceLogs(userId, lines);
    if (res.ok) {
      res.raw = stripAnsi(res.raw || '');
      res.lines = (res.lines || []).map(stripAnsi);
    }
    setLoading(false);
    setResult(res);
  }, [userId, lines]);

  useEffect(() => { if (open) fetchLogs(); }, [open, fetchLogs]);

  // Auto-scroll to bottom whenever new logs arrive
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [result]);

  const copyLogs = async () => {
    const txt = result?.raw || (result?.lines || []).join('\n');
    await navigator.clipboard.writeText(txt);
    toast({ title: 'Copied', description: 'Logs copied to clipboard' });
  };

  const isContainerMissing = result && !result.ok &&
    /no such container|not.?found|missing/i.test(`${result.error} ${JSON.stringify(result.detail || '')}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Container logs — {userName}</DialogTitle>
          <DialogDescription>Last {lines} lines (capped at 300).</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          {[50, 100, 200, 300].map(n => (
            <Button key={n} variant={lines === n ? 'default' : 'outline'} size="sm" onClick={() => setLines(n)}>{n}</Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Reload
            </Button>
            <Button size="sm" variant="outline" onClick={copyLogs} disabled={!result?.ok}>
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
          </div>
        </div>
        {isContainerMissing && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            Container missing — provision or start it before viewing logs.
          </div>
        )}
        <pre
          ref={preRef}
          className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-[11px] font-mono leading-snug"
        >
{loading ? 'Loading…' : (result?.raw || (result?.lines || []).join('\n') || '(no output)')}
        </pre>
        <ErrorDetail result={result} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
