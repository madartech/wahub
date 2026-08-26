import { QrResultSummary } from '@/hooks/useQrPreparation';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

/**
 * Secondary, collapsed diagnostics. Never the primary user-facing state — the
 * QR flow only looks failed after the 120s preparation window expires.
 */
export default function QrDebugSummary({ result }: { result: QrResultSummary | null }) {
  if (!result) return null;
  return (
    <Collapsible className="w-full text-xs text-muted-foreground">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          Show debug <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 rounded border bg-muted/40 p-2">
        <div className="space-y-1 break-all text-left">
          <p>User ID: {result.userId}</p>
          <p>Endpoint: {result.endpoint}</p>
          <p>Poll #{result.retryCount} at {result.polledAt}</p>
          <p>Last QR: ok={String(result.ok)}, status={result.status || 'none'}, error={result.error || 'none'}, hasDataUrl={String(result.hasDataUrl)}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
