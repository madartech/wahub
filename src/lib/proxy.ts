// Proxy helpers: stable sessid derivation + username template rendering.
// The proxy PASSWORD never lives in the frontend — the gateway injects it
// from a server-side env var (THORDATA_PROXY_PASSWORD).

export interface ProxyDefaults {
  enabled: boolean;
  host: string;
  port: number;
  /** Base customer username, e.g. "td-customer-kXVywm6vs94a" */
  usernameBase: string;
  /** Two-letter country code, e.g. "OM". Empty = no country pin. */
  country: string;
  /** Sticky session duration in minutes (Thordata max 90). */
  sessTime: number;
  /** Optional extra targeting segments, e.g. "state-Muscat-city-Muscat" */
  extraSegments?: string;
}

export const DEFAULT_PROXY: ProxyDefaults = {
  enabled: false,
  host: '6by2mxeg.as.thordata.net',
  port: 9999,
  usernameBase: 'td-customer-kXVywm6vs94a',
  country: 'OM',
  sessTime: 90,
  extraSegments: '',
};

/**
 * Stable, deterministic sessid for an instance.
 * Same instance -> same sticky IP slot across restarts, so a reconnecting
 * user doesn't hop networks mid-session.
 */
export function deriveSessId(user: { id: string; instanceId?: string | null }): string {
  const raw = (user.instanceId || user.id || '').toString();
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `wa${clean || 'x'}`.slice(0, 24);
}

/** Build the full Thordata username string for a given instance. */
export function buildProxyUsername(cfg: ProxyDefaults, sessId: string): string {
  const parts = [cfg.usernameBase];
  if (cfg.country) parts.push(`country-${cfg.country.toUpperCase()}`);
  if (cfg.extraSegments) {
    cfg.extraSegments.split('-').length > 1 && parts.push(cfg.extraSegments.replace(/^-+|-+$/g, ''));
  }
  parts.push(`sessid-${sessId}`);
  parts.push(`sesstime-${cfg.sessTime}`);
  return parts.join('-');
}

/** Masked, password-free proxy URL for display. */
export function buildProxyPreview(cfg: ProxyDefaults, sessId: string): string {
  return `http://${buildProxyUsername(cfg, sessId)}:••••••@${cfg.host}:${cfg.port}`;
}

const KEY = 'gateway_proxy_defaults';

export function loadProxyDefaults(): ProxyDefaults {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROXY };
    return { ...DEFAULT_PROXY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROXY };
  }
}

export function saveProxyDefaults(cfg: ProxyDefaults) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}
