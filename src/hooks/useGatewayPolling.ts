import { useEffect, useRef } from 'react';

/**
 * Calls `fn` immediately and then on `intervalMs` while `enabled` is true.
 * Set `paused` to true to suspend polling without unmounting (e.g. modal open).
 */
export function useGatewayPolling(
  fn: () => void | Promise<void>,
  intervalMs = 30_000,
  { enabled = true, paused = false }: { enabled?: boolean; paused?: boolean } = {},
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled || paused) return;
    let cancelled = false;
    const tick = () => { if (!cancelled) fnRef.current(); };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [enabled, paused, intervalMs]);
}
