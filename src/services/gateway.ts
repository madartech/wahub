import { 
  HealthResponse, 
  SendMessagePayload, 
  SendMessageResponse,
  UsersListResponse,
  CreateUserResponse,
  ProvisionResponse,
  QRResponse 
} from '@/types/gateway';

const GATEWAY_BASE_URL = 'https://gateway.madarivms.com';
const ADMIN_TOKEN = '@dmin142242';

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
      const res = await fetch(`${GATEWAY_BASE_URL}/admin/users`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': ADMIN_TOKEN,
        },
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
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return {
      ok: true,
      dataUrl: data.dataUrl,
    };
  },

  // Send message
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
};
