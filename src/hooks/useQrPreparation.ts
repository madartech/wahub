import { useCallback, useEffect, useRef, useState } from 'react';
import { gatewayService } from '@/services/gateway';
import { QRResponse, SessionStatus } from '@/types/gateway';

export const QR_POLL_INTERVAL_MS = 3000;
export const QR_AUTO_PROVISION_INTERVAL_MS = 12000;
export const QR_WAITING_MESSAGE = 'Preparing QR automatically… please wait.';

export interface QrResultSummary {
  ok: boolean;
  userId: string;
  endpoint: string;
  polledAt: string;
  retryCount: number;
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
  /** True while the panel is active and no QR is rendered. */
  waiting: boolean;
  /** Retained for consumer compatibility; the self-healing loop runs until closed. */
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
 * - Opening the panel provisions immediately, polls every 3 seconds, and
 *   provisions again every 12 seconds until an image is available or it closes.
 * - Any response WITHOUT a `data:image/` payload is retryable while active
 *   (qr_starting, STARTING, UNKNOWN, aborts, timeouts, 502, 524, …).
 * - Any response WITH a `data:image/` payload renders immediately and stops
 *   polling, regardless of ok/status/cached metadata.
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

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const provisionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef(0);
  const retryCountRef = useRef(0);

  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const onQrLoadedRef = useRef(onQrLoaded);
  onQrLoadedRef.current = onQrLoaded;

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (provisionTimerRef.current) {
      clearInterval(provisionTimerRef.current);
      provisionTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    clearTimers();
  }, [clearTimers]);

  const reset = useCallback(() => {
    stop();
    retryCountRef.current = 0;
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
        // Network/abort failures are retryable, never terminal while active.
        result = {
          ok: false,
          userId: id,
          endpoint: `/admin/users/${encodeURIComponent(id)}/qr-base64`,
          polledAt: new Date().toISOString(),
          error: e instanceof Error ? e.message : 'network_error',
        };
      }
      console.log('[QR_BASE64_RESPONSE]', result);
      if (token !== tokenRef.current) return;

      const gotImage = hasQrImage(result);
      retryCountRef.current += 1;
      setLastResult({
        ok: result.ok,
        userId: result.userId || id,
        endpoint: result.endpoint || `/admin/users/${encodeURIComponent(id)}/qr-base64`,
        polledAt: result.polledAt || new Date().toISOString(),
        retryCount: retryCountRef.current,
        status: result.status,
        error: result.error,
        hasDataUrl: gotImage,
      });

      // The image payload is authoritative — commit before any other check.
      if (gotImage) {
        stop();
        setDataUrl(result.dataUrl as string);
        setError(null);
        setExpired(false);
        setProgress(100);
        onQrLoadedRef.current?.();
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

      // Every non-image response is transient. Keep polling while this
      // generation remains active; the separate 12s timer re-provisions it.
      setProgress((retryCountRef.current % 4) * 25);
      pollTimerRef.current = setTimeout(
        () => void poll(id, token),
        QR_POLL_INTERVAL_MS,
      );
    },

    [stop],
  );

  const start = useCallback((showRefreshState = false) => {
    if (!userId) return;
    clearTimers();
    const token = ++tokenRef.current;
    retryCountRef.current = 0;
    setDataUrl(null);
    setExpired(false);
    setConnected(false);
    setError(null);
    setLastResult(null);
    setProgress(0);

    const provision = async () => {
      if (token !== tokenRef.current) return;
      try {
        await gatewayService.provisionUser(userId);
      } catch (e) {
        // Provision errors are transient: polling and the next automatic
        // provision attempt continue while the panel remains open.
        console.warn('[QR_AUTO_PROVISION_FAILED]', { userId, error: e });
      } finally {
        if (showRefreshState && token === tokenRef.current) setRefreshing(false);
      }
    };

    setRefreshing(showRefreshState);
    void provision();
    void poll(userId, token);
    provisionTimerRef.current = setInterval(
      () => void provision(),
      QR_AUTO_PROVISION_INTERVAL_MS,
    );
  }, [userId, clearTimers, poll]);

  const restart = useCallback(() => {
    start(false);
  }, [start]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    start(true);
  }, [userId, start]);

  useEffect(() => {
    if (!active || !userId) {
      reset();
      return;
    }
    start(false);
    return () => { stop(); };
  }, [active, userId, start, reset, stop]);

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
