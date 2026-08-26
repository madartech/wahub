import { useCallback, useEffect, useRef, useState } from 'react';
import { gatewayService } from '@/services/gateway';
import { QRResponse, SessionStatus } from '@/types/gateway';

export const QR_POLL_INTERVAL_MS = 3000;
export const QR_MAX_WINDOW_MS = 120000;
export const QR_WAITING_MESSAGE = 'Preparing QR… retrying automatically';

export interface QrResultSummary {
  ok: boolean;
  status?: SessionStatus;
  error?: string;
  hasDataUrl: boolean;
}

export interface UseQrPreparationOptions {
  userId?: string;
  /** Start (and keep) the polling loop while true. */
  active: boolean;
  /** Called once when the backend reports the session is already connected. */
  onConnected?: () => void;
  /** Called whenever a QR image is rendered for the first time in a window. */
  onQrLoaded?: () => void;
}

export interface UseQrPreparationResult {
  dataUrl: string | null;
  /** True while the 120s retry window is still open and no QR is rendered. */
  waiting: boolean;
  /** Only true after the retry window expired without a QR image. */
  expired: boolean;
  connected: boolean;
  error: string | null;
  waitingMessage: string;
  lastResult: QrResultSummary | null;
  progress: number;
  refreshing: boolean;
  /** Provision again, clear the QR image, restart polling from zero. */
  refresh: () => Promise<void>;
  /** Restart polling from zero without calling provision. */
  restart: () => void;
  /** Stop polling and clear all QR state. */
  reset: () => void;
}

export function hasQrImage(r: Pick<QRResponse, 'dataUrl'>): boolean {
  return typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:image/');
}

/**
 * Shared, instance-agnostic QR preparation flow.
 *
 * Contract:
 * - Any response WITHOUT a `data:image/` payload is retryable while the window
 *   is open (qr_starting, STARTING, UNKNOWN, aborts, timeouts, 502, 524, …).
 * - Any response WITH a `data:image/` payload renders immediately and stops
 *   polling, regardless of ok/status/cached metadata.
 * - Only after the window expires is an error surfaced to the user.
 */
export function useQrPreparation({
  userId,
  active,
  onConnected,
  onQrLoaded,
}: UseQrPreparationOptions): UseQrPreparationResult {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QrResultSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);
  const deadlineRef = useRef(0);
  const qrLoadedRef = useRef(false);

  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const onQrLoadedRef = useRef(onQrLoaded);
  onQrLoadedRef.current = onQrLoaded;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    stop();
    qrLoadedRef.current = false;
    setDataUrl(null);
    setExpired(false);
    setConnected(false);
    setError(null);
    setLastResult(null);
    setProgress(0);
  }, [stop]);

  const poll = useCallback(
    async (id: string, token: number) => {
      let result: QRResponse;
      try {
        result = await gatewayService.getQRCode(id);
      } catch (e) {
        // Network/abort failures are retryable, never terminal mid-window.
        result = { ok: false, error: e instanceof Error ? e.message : 'network_error' };
      }
      console.log('[QR_BASE64_RESPONSE]', result);
      if (token !== tokenRef.current) return;

      const gotImage = hasQrImage(result);
      setLastResult({
        ok: result.ok,
        status: result.status,
        error: result.error,
        hasDataUrl: gotImage,
      });

      // The image payload is authoritative — commit before any other check.
      if (gotImage) {
        qlComplete(result.dataUrl as string);
        return;
      }

      if (result.alreadyConnected || result.status === 'WORKING' || result.status === 'READY') {
        stop();
        setConnected(true);
        setError(null);
        setProgress(100);
        onConnectedRef.current?.();
        return;
      }

      const remaining = deadlineRef.current - Date.now();
      setProgress(
        Math.min(100, Math.max(0, ((QR_MAX_WINDOW_MS - remaining) / QR_MAX_WINDOW_MS) * 100)),
      );

      if (remaining > 0) {
        timerRef.current = setTimeout(
          () => void poll(id, token),
          Math.max(QR_POLL_INTERVAL_MS, result.retryAfterMs || 0),
        );
        return;
      }

      setExpired(true);
      setProgress(100);
      setError(
        result.error && result.error !== 'qr_starting'
          ? result.error
          : 'QR was not ready after 120 seconds. Try Refresh QR.',
      );

      function qlComplete(url: string) {
        stop();
        qrLoadedRef.current = true;
        setDataUrl(url);
        setError(null);
        setExpired(false);
        setProgress(100);
        onQrLoadedRef.current?.();
      }
    },
    [stop],
  );

  const restart = useCallback(() => {
    if (!userId) return;
    clearTimer();
    const token = ++tokenRef.current;
    qrLoadedRef.current = false;
    deadlineRef.current = Date.now() + QR_MAX_WINDOW_MS;
    setDataUrl(null);
    setExpired(false);
    setConnected(false);
    setError(null);
    setLastResult(null);
    setProgress(0);
    void poll(userId, token);
  }, [userId, clearTimer, poll]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    // Clear the stale image first so a failed scan cannot linger on screen.
    stop();
    qrLoadedRef.current = false;
    setDataUrl(null);
    setExpired(false);
    setError(null);
    setLastResult(null);
    setProgress(0);
    try {
      await gatewayService.provisionUser(userId);
    } catch (e) {
      // Provision failures must not end the flow — the container may already
      // be running and the background QR job can still deliver an image.
      console.warn('[QR_REFRESH_PROVISION_FAILED]', e);
    }
    setRefreshing(false);
    restart();
  }, [userId, stop, restart]);

  useEffect(() => {
    if (!active || !userId) {
      reset();
      return;
    }
    restart();
    return () => { stop(); };
    // restart/reset/stop are stable per userId
  }, [active, userId, restart, reset, stop]);

  useEffect(() => () => { stop(); }, [stop]);

  const waiting = !dataUrl && !connected && !expired && active;

  return {
    dataUrl,
    waiting,
    expired,
    connected,
    error,
    waitingMessage: QR_WAITING_MESSAGE,
    lastResult,
    progress,
    refreshing,
    refresh,
    restart,
    reset,
  };
}
