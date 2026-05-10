import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { OperationResponse } from '@/types/gateway';

export default function ErrorDetail({ result }: { result: OperationResponse | null }) {
  const [open, setOpen] = useState(false);
  if (!result || result.ok) return null;
  return (
    <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-destructive">
          {result.notDeployed
            ? 'Endpoint not deployed yet — apply backend patch (docs/gateway-server-patch.js)'
            : `Error: ${result.error}`}
        </span>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Detail
        </button>
      </div>
      {open && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] font-mono text-muted-foreground">
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
