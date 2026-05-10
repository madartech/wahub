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
    
    const data = await res.json();
    
    if (!res.ok) {
      // Return error response instead of throwing
      return {
        ok: false,
        error: data.error || data.message || `HTTP ${res.status}`,
        status: data.status as SessionStatus,
      };
    }
    
    // Check if already connected
    if (data.alreadyConnected) {
      return {
        ok: true,
        alreadyConnected: true,
        status: data.status as SessionStatus,
      };
    }
    
    return {
      ok: true,
      dataUrl: data.dataUrl,
      status: data.status as SessionStatus,
    };
  },

  // Get user status - returns full session info (with 5s timeout)
  async getUserStatus(userId: string): Promise<UserStatusResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
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

  // Disconnect user session
  async disconnectUser(userId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}/disconnect`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
      },
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return { ok: true };
  },

  // Reset user session (re-provision)
  async resetUser(userId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/users/${userId}/reset`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
      },
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return { ok: true };
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
};
