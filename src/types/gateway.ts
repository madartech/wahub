// Session status from WAHA backend
export type SessionStatus = 
  | 'WORKING' 
  | 'READY' 
  | 'SCAN_QR_CODE' 
  | 'STARTING' 
  | 'STOPPED' 
  | 'FAILED'
  | 'UNKNOWN';

// Derived UI state from session status
export type UserConnectionState = 
  | 'not_provisioned'
  | 'provisioning'
  | 'scan_qr'
  | 'connected';

export interface SendStats {
  minute?: number;
  hour?: number;
  day?: number;
}

export interface GatewayUser {
  id: string;
  name: string;
  instanceId?: string;
  port?: number;
  gatewayUrl?: string;
  token?: string;
  tokenMasked?: string;
  phoneNumber?: string | null;
  sessionStatus?: SessionStatus;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
  // Operations fields (may be returned by extended /admin/users)
  containerName?: string;
  pushName?: string | null;
  lastActivityAt?: string | null;
  pausedUntil?: string | null;
  sendStats?: SendStats;
  containerStatus?: string;
  statusChangedAt?: string | null;
}

export function getConnectionState(status?: SessionStatus): UserConnectionState {
  switch (status) {
    case 'WORKING':
    case 'READY':
      return 'connected';
    case 'SCAN_QR_CODE':
      return 'scan_qr';
    case 'STARTING':
      return 'provisioning';
    case 'STOPPED':
    case 'UNKNOWN':
    default:
      return 'not_provisioned';
  }
}

export type HealthLevel =
  | 'healthy'
  | 'needs_qr'
  | 'stuck'
  | 'starting'
  | 'offline'
  | 'paused'
  | 'container_missing'
  | 'failed';

export interface UserStatusResponse {
  ok: boolean;
  session?: {
    status: SessionStatus;
  };
  me?: {
    id?: string;
    pushName?: string;
  } | null;
  phoneNumber?: string | null;
  containerStatus?: string;
  warning?: string;
  detail?: string;
  error?: string;
}

export interface QRResponse {
  ok: boolean;
  dataUrl?: string;
  cached?: boolean;
  retryAfterMs?: number;
  alreadyConnected?: boolean;
  status?: SessionStatus;
  httpStatus?: number;
  error?: string;
  detail?: string;
  body?: string;
}

/**
 * Any QR response that does not carry a renderable image is retryable while the
 * preparation window is open: startup states, unknown states, aborts, timeouts
 * and gateway errors (502/504/524) are all transient for a booting container.
 */
export function isRetryableQRResponse(response: QRResponse): boolean {
  const hasImage = typeof response.dataUrl === 'string' && response.dataUrl.startsWith('data:image/');
  if (hasImage) return false;
  if (response.alreadyConnected || response.status === 'WORKING' || response.status === 'READY') {
    return false;
  }
  return true;
}


export interface HealthResponse {
  ok: boolean;
}

export interface CreateUserResponse {
  ok: boolean;
  id: string;
  name: string;
  token: string;
  gatewayUrl: string;
  error?: string;
}

export interface ProvisionResponse {
  ok: boolean;
  userId?: string;
  instanceId?: string;
  port?: number;
  qrEndpoint?: string;
  status?: SessionStatus;
  qrPreparing?: boolean;
  error?: string;
}

export interface UsersListResponse {
  ok: boolean;
  users: GatewayUser[];
  error?: string;
}

export interface SendMessagePayload {
  to: string;
  text: string;
}

export interface SendMessageResponse {
  ok: boolean;
  waha?: unknown;
  timestamp?: string;
  ack?: string;
  error?: string;
}

export interface OperationResponse {
  ok: boolean;
  status?: number;
  error?: string;
  detail?: unknown;
  notDeployed?: boolean;
  data?: unknown;
}

export interface LogsResponse extends OperationResponse {
  lines?: string[];
  raw?: string;
}

// ===== Proxy (per-instance residential egress) =====
export interface ProxyOverride {
  enabled?: boolean;
  host?: string;
  port?: number;
  usernameBase?: string;
  country?: string;
  sessTime?: number;
  extraSegments?: string;
  sessId?: string;
}

export interface EffectiveProxy {
  host: string;
  port: number;
  sessId: string;
  username: string;
}

export interface EgressInfo {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
  asn?: string;
  raw?: string;
}
