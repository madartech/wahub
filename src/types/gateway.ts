export interface GatewayUser {
  id: string;
  name: string;
  instanceId?: string;
  port?: number;
  gatewayUrl?: string;
  provisioned: boolean;
  token?: string;
  tokenMasked?: string;
  phoneNumber?: string | null;
  lastStatus?: string | null;
}

export interface UserStatusResponse {
  ok: boolean;
  phoneNumber?: string | null;
  status?: string;
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
  userId: string;
  instanceId: string;
  port: number;
  qrEndpoint: string;
  error?: string;
}

export interface QRResponse {
  ok: boolean;
  dataUrl: string;
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
