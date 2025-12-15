export interface GatewayUser {
  id: string;
  name: string;
  instance: string;
  token: string;
}

export interface HealthResponse {
  ok: boolean;
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
