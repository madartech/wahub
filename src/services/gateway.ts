import { GatewayUser, HealthResponse, SendMessagePayload, SendMessageResponse } from '@/types/gateway';

const GATEWAY_BASE_URL = 'https://gateway.madarivms.com';
const USERS_STORAGE_KEY = 'gateway_users';

// Seed data
const seedUsers: GatewayUser[] = [
  { id: '1', name: 'User 1', instance: 'u1', token: 'token_user1_ChangeMe' },
  { id: '2', name: 'User 2', instance: 'u2', token: 'token_user2_ChangeMe' },
];

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

  // Users management (localStorage)
  getUsers(): GatewayUser[] {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return seedUsers;
      }
    }
    // Initialize with seed data
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(seedUsers));
    return seedUsers;
  },

  getUserById(id: string): GatewayUser | undefined {
    const users = this.getUsers();
    return users.find(u => u.id === id);
  },

  addUser(user: Omit<GatewayUser, 'id'>): GatewayUser {
    const users = this.getUsers();
    const newUser: GatewayUser = {
      ...user,
      id: Date.now().toString(),
    };
    users.push(newUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return newUser;
  },

  deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  },

  getGatewayUrl(): string {
    return `${GATEWAY_BASE_URL}/gateway/whatsapp/send`;
  },
};
