import { 
  HealthResponse, 
  SendMessagePayload, 
  SendMessageResponse,
  UsersListResponse,
  CreateUserResponse,
  ProvisionResponse,
  QRResponse,
  UserStatusResponse,
  SessionStatus,
  OperationResponse,
  LogsResponse,
} from '@/types/gateway';
import { GATEWAY_BASE_URL, ADMIN_TOKEN } from '@/config/gateway';

export const gatewayService = {
  // Health check
  async checkHealth(): Promise<HealthResponse> {
    try {
      const res = await fetch(`${GATEWAY_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      return { ok: data.ok === true };
    } catch {
      return { ok: false };
    }
  },

  // Get all users from backend
  async getUsers(): Promise<UsersListResponse> {
    try {
      const res = await fetch(`${GATEWAY_BASE_URL}/admin/users?_t=${Date.now()}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': ADMIN_TOKEN,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
      
      return { ok: true, users: data.users || [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch users';
      return { ok: false, users: [], error: errorMessage };
    }
  },

  // Get user token (reveal full token)
  async getUserToken(userId: string): Promise<{ ok: boolean; token: string }> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}/token`, {
      method: 'GET',
      headers: { 
        'X-Admin-Token': ADMIN_TOKEN,
      },
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return { ok: true, token: data.token };
  },

  // Create a new user
  async createUser(name: string): Promise<CreateUserResponse> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ name }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return {
      ok: true,
      id: data.id,
      name: data.name,
      token: data.token,
      gatewayUrl: data.gatewayUrl,
    };
  },

  // Provision a user (create WAHA instance)
  async provisionUser(userId: string): Promise<ProvisionResponse> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}/provision`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify({}),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return {
      ok: true,
      userId: data.userId,
      instanceId: data.instanceId,
      port: data.port,
      qrEndpoint: data.qrEndpoint,
      status: data.status as SessionStatus,
    };
  },

  // Get QR code as base64
  async getQRCode(userId: string): Promise<QRResponse> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}/qr-base64`, {
      method: 'GET',
      headers: { 
        'X-Admin-Token': ADMIN_TOKEN,
      },
    });
    
    const data = await res.json().catch(() => ({} as any));

    // Normalize both old (GOWS) and new (WEBJS) response shapes
    const status = (data.status || data.session?.status) as SessionStatus | undefined;
    const dataUrl: string | undefined =
      data.dataUrl ||
      data.qr?.dataUrl ||
      (data.data ? `data:${data.mimetype || 'image/png'};base64,${data.data}` : undefined) ||
      (data.base64 ? `data:${data.mimetype || 'image/png'};base64,${data.base64}` : undefined) ||
      (typeof data.qr === 'string'
        ? (data.qr.startsWith('data:') ? data.qr : `data:image/png;base64,${data.qr}`)
        : undefined);

    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || data.message || `HTTP ${res.status}`,
        status,
      };
    }

    if (data.alreadyConnected || status === 'WORKING') {
      return { ok: true, alreadyConnected: true, status };
    }

    if (!dataUrl) {
      return { ok: false, error: data.error || data.message || 'QR not available yet', status };
    }

    return { ok: true, dataUrl, status };
  },


  // Get user status - returns full session info (with 5s timeout)
  async getUserStatus(userId: string): Promise<UserStatusResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}/status`, {
        method: 'GET',
        headers: { 
          'X-Admin-Token': ADMIN_TOKEN,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (!res.ok) {
        return {
          ok: false,
          error: data.error || data.message || `HTTP ${res.status}`,
          session: { status: 'UNKNOWN' as SessionStatus },
        };
      }
      
      return {
        ok: true,
        session: {
          status: (data.session?.status || data.status || 'UNKNOWN') as SessionStatus,
        },
        me: data.me || null,
        phoneNumber: data.me?.id || data.phoneNumber || null,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Request timed out'
          : error instanceof Error
            ? error.message
            : 'Failed to get status';

      return {
        ok: false,
        error: errorMessage,
        session: { status: 'UNKNOWN' as SessionStatus },
      };
    }
  },

  // Get WhatsApp pairing code (alternative to QR)
  async getPairingCode(userId: string, phone: string): Promise<{
    ok: boolean;
    code?: string;
    phoneNumber?: string;
    instanceId?: string;
    error?: string;
    detail?: string;
    notProvisioned?: boolean;
  }> {
    try {
      const res = await fetch(
        `${GATEWAY_BASE_URL}/admin/users/${userId}/pairing-code?phone=${encodeURIComponent(phone)}`,
        { method: 'GET', headers: { 'X-Admin-Token': ADMIN_TOKEN } },
      );
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
      if (!res.ok) {
        const err = data?.error || data?.message || `HTTP ${res.status}`;
        const notProvisioned =
          res.status === 404 ||
          /fetch|status|provision|no such container|container.*not.?found|missing/i.test(
            `${err} ${JSON.stringify(data?.detail || '')}`,
          );
        return {
          ok: false,
          error: err,
          detail: typeof data?.detail === 'string' ? data.detail : data?.detail ? JSON.stringify(data.detail) : undefined,
          notProvisioned,
        };
      }
      return {
        ok: true,
        code: data?.code || data?.raw?.code,
        phoneNumber: data?.phoneNumber,
        instanceId: data?.instanceId,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
    }
  },

  // Test send message (admin endpoint)
  async testSendMessage(userId: string, payload: SendMessagePayload): Promise<SendMessageResponse> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}/test-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return {
      ok: data.ok,
      waha: data.waha,
      timestamp: new Date().toISOString(),
    };
  },

  // Send message (public endpoint with token)
  async sendMessage(token: string, payload: SendMessagePayload): Promise<SendMessageResponse> {
    const res = await fetch(`${GATEWAY_BASE_URL}/gateway/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return {
      ok: data.ok,
      waha: data.waha,
      timestamp: new Date().toISOString(),
    };
  },

  getGatewayUrl(): string {
    return `${GATEWAY_BASE_URL}/gateway/whatsapp/send`;
  },

  // Update user name
  async updateUser(userId: string, name: string): Promise<{ ok: boolean; name: string }> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ name }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return { ok: true, name: data.name || name };
  },

  // Delete user
  async deleteUser(userId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 
        'X-Admin-Token': ADMIN_TOKEN,
      },
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return { ok: true };
  },

  // ===== Operations admin endpoints (graceful 404 if not deployed) =====
  async _adminOp(
    method: 'POST' | 'GET',
    path: string,
    body?: unknown,
  ): Promise<OperationResponse> {
    try {
      const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': ADMIN_TOKEN,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      let data: any = null;
      const text = await res.text();
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data?.error || data?.message || `HTTP ${res.status}`,
          detail: data,
          notDeployed: res.status === 404,
        };
      }
      return { ok: true, status: res.status, data };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'network_error', detail: String(e) };
    }
  },

  restartInstance(userId: string)        { return this._adminOp('POST', `/admin/users/${userId}/restart`); },
  stopInstance(userId: string)           { return this._adminOp('POST', `/admin/users/${userId}/stop`); },
  startInstance(userId: string)          { return this._adminOp('POST', `/admin/users/${userId}/start`); },
  removeContainer(userId: string)        { return this._adminOp('POST', `/admin/users/${userId}/remove-container`); },
  resetSession(userId: string)           { return this._adminOp('POST', `/admin/users/${userId}/reset-session`); },
  pauseSending(userId: string, minutes: number) { return this._adminOp('POST', `/admin/users/${userId}/pause`, { minutes }); },
  resumeSending(userId: string)          { return this._adminOp('POST', `/admin/users/${userId}/resume`); },
  adminTestSend(userId: string, payload: SendMessagePayload) {
    return this._adminOp('POST', `/admin/users/${userId}/test-send`, payload);
  },
  async getInstanceLogs(userId: string, lines = 100): Promise<LogsResponse> {
    const op = await this._adminOp('GET', `/admin/users/${userId}/logs?lines=${Math.min(300, Math.max(1, lines))}`);
    if (!op.ok) return op as LogsResponse;
    const d = op.data as any;
    return { ...op, lines: d?.lines || (d?.raw ? String(d.raw).split('\n') : []), raw: d?.raw || '' };
  },

  // ===== Proxy config (graceful 404 until backend patch is deployed) =====
  getProxyDefaults()                          { return this._adminOp('GET', '/admin/proxy/defaults'); },
  setProxyDefaults(cfg: unknown)              { return this._adminOp('POST', '/admin/proxy/defaults', cfg); },
  getUserProxy(userId: string)                { return this._adminOp('GET', `/admin/users/${userId}/proxy`); },
  setUserProxy(userId: string, cfg: unknown)  { return this._adminOp('POST', `/admin/users/${userId}/proxy`, cfg); },
  clearUserProxy(userId: string)              { return this._adminOp('POST', `/admin/users/${userId}/proxy`, { clear: true }); },
  getEgressIp(userId: string)                 { return this._adminOp('GET', `/admin/users/${userId}/egress-ip`); },
  bulkAssignProxy()                           { return this._adminOp('POST', '/admin/proxy/bulk-assign'); },

};
