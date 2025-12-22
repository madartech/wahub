// Session status from WAHA backend
export type SessionStatus = 
  | 'WORKING' 
  | 'READY' 
  | 'SCAN_QR_CODE' 
  | 'STARTING' 
  | 'STOPPED' 
  | 'UNKNOWN';

// Derived UI state from session status
export type UserConnectionState = 
  | 'not_provisioned'   // STOPPED or no status
  | 'provisioning'      // STARTING
  | 'scan_qr'           // SCAN_QR_CODE
  | 'connected';        // WORKING or READY

export interface GatewayUser {
  id: string;
  name: string;
  instanceId?: string;
  port?: number;
  gatewayUrl?: string;
  token?: string;
  tokenMasked?: string;
  // These are derived from status, not stored
  phoneNumber?: string | null;
  // Session status from backend
  sessionStatus?: SessionStatus;
  // User me info from backend
  me?: {
    id?: string;
    pushName?: string;
  } | null;
}

// Helper to derive connection state from session status
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
  error?: string;
}

export interface QRResponse {
  ok: boolean;
  dataUrl?: string;
  alreadyConnected?: boolean;
  status?: SessionStatus;
  error?: string;
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
