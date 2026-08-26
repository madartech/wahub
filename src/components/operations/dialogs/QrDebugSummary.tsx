import { QrResultSummary } from '@/hooks/useQrPreparation';

/**
 * Secondary, collapsed diagnostics. Never the primary user-facing state — the
 * QR flow only looks failed after the 120s preparation window expires.
 */
export default function QrDebugSummary({ result }: { result: QrResultSummary | null }) {
  if (!result) return null;
  return (
    <details className="w-full text-center text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Debug details</summary>
      <div className="mt-1 space-y-1 break-all text-left">
        <p>User ID: {result.userId}</p>
        <p>Endpoint: {result.endpoint}</p>
        <p>Poll #{result.retryCount} at {result.polledAt}</p>
        <p>Last QR: ok={String(result.ok)}, status={result.status || 'none'}, error={result.error || 'none'}, hasDataUrl={String(result.hasDataUrl)}</p>
      </div>
    </details>
  );
}
