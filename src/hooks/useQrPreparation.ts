import { useCallback, useEffect, useRef, useState } from 'react';
import { gatewayService } from '@/services/gateway';

export const QR_POLL_INTERVAL_MS = 3000;
export const QR_AUTO_PROVISION_INTERVAL_MS = 12000;
export const QR_WAITING_MESSAGE = 'Preparing WhatsApp QR… this usually takes a few seconds.';

export interface UseQrPreparationOptions {
  userId?: string;
  /** Run the provision + poll loop while true. */
  active: boolean;
  /** Fired once when the backend reports the session is connected. */
  onConnected?: () => void;
  /** Fired once when a QR image is rendered. */
  onQrLoaded?: () => void;
}

export interface UseQrPreparationResult {
  dataUrl: string | null;
  connected: boolean;
  waiting: boolean;
  attempt: number;
  refreshing: boolean;
  waitingMessage: string;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * Simple, reliable QR preparation loop:
 * provision immediately, poll /qr-base64 immediately and then every 3s,
 * re-provision every 12s until a QR image or a connected session appears.
 */
export function useQrPreparation({
  userId,
  active,
  onConnected,
  onQrLoaded,
}: UseQrPreparationOptions): UseQrPreparationResult {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const provisionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genRef = useRef(0);

  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const onQrLoadedRef = useRef(onQrLoaded);
  onQrLoadedRef.current = onQrLoaded;

  const clearTimers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (provisionRef.current) {
      clearInterval(provisionRef.current);
      provisionRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    genRef.current += 1;
    clearTimers();
    setDataUrl(null);
    setConnected(false);
    setAttempt(0);
    setRefreshing(false);
  }, [clearTimers]);

  const start = useCallback((id: string, showRefreshing: boolean) => {
    clearTimers();
    const gen = ++genRef.current;
    setDataUrl(null);
    setConnected(false);
    setAttempt(0);
    setRefreshing(showRefreshing);

    const provision = async () => {
      if (gen !== genRef.current) return;
      try {
        await gatewayService.provisionUser(id);
      } catch (e) {
        console.info('[QR_PROVISION_RETRY]', { userId: id, error: e });
      } finally {
        if (gen === genRef.current) setRefreshing(false);
      }
    };

    const poll = async () => {
      if (gen !== genRef.current) return;
      try {
        const r = await gatewayService.getQRCode(id);
        if (gen !== genRef.current) return;
        setAttempt((n) => n + 1);

        if (typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:image/')) {
          genRef.current += 1;
          clearTimers();
          setDataUrl(r.dataUrl);
          setRefreshing(false);
          onQrLoadedRef.current?.();
          return;
        }

        if (r.status === 'WORKING' || r.status === 'READY' || r.alreadyConnected) {
          genRef.current += 1;
          clearTimers();
          setConnected(true);
          setRefreshing(false);
          onConnectedRef.current?.();
        }
      } catch (e) {
        if (gen !== genRef.current) return;
        setAttempt((n) => n + 1);
        console.info('[QR_POLL_RETRY]', { userId: id, error: e });
      }
    };

    void provision();
    void poll();
    pollRef.current = setInterval(() => void poll(), QR_POLL_INTERVAL_MS);
    provisionRef.current = setInterval(() => void provision(), QR_AUTO_PROVISION_INTERVAL_MS);
  }, [clearTimers]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    start(userId, true);
  }, [userId, start]);

  useEffect(() => {
    if (!active || !userId) {
      reset();
      return;
    }
    start(userId, false);
    return () => {
      genRef.current += 1;
      clearTimers();
    };
  }, [active, userId, start, reset, clearTimers]);

  return {
    dataUrl,
    connected,
    waiting: active && !dataUrl && !connected,
    attempt,
    refreshing,
    waitingMessage: QR_WAITING_MESSAGE,
    refresh,
    reset,
  };
}
