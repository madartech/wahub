import { User, AuthUser, LoginCredentials, SendTextPayload, SendMediaPayload, SessionStatus, MessageHistory } from '@/types';

// Production API base URL
const API_BASE_URL = 'https://api.madarivms.com';

// Fake data store
let users: User[] = [
  {
    id: '1',
    username: 'john_doe',
    password: 'password123',
    status: 'active',
    apiKey: 'api_key_abc123xyz',
    messageCount: 150,
    sessionStatus: 'online',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    username: 'jane_smith',
    password: 'password456',
    status: 'active',
    apiKey: 'api_key_def456uvw',
    messageCount: 89,
    sessionStatus: 'qr_pending',
    createdAt: new Date('2024-02-20'),
  },
  {
    id: '3',
    username: 'bob_wilson',
    password: 'password789',
    status: 'disabled',
    apiKey: 'api_key_ghi789rst',
    messageCount: 0,
    sessionStatus: 'offline',
    createdAt: new Date('2024-03-10'),
  },
];

// Fake message history data
const messageHistory: MessageHistory[] = [
  {
    id: '1',
    recipientNumber: '+1234567890',
    messageType: 'text',
    content: 'Hello! This is a test message.',
    timestamp: new Date('2024-03-15T10:30:00'),
    status: 'delivered',
  },
  {
    id: '2',
    recipientNumber: '+1987654321',
    messageType: 'image',
    content: 'product_photo.jpg',
    timestamp: new Date('2024-03-15T11:45:00'),
    status: 'delivered',
  },
  {
    id: '3',
    recipientNumber: '+1555123456',
    messageType: 'text',
    content: 'Your order has been confirmed!',
    timestamp: new Date('2024-03-15T14:20:00'),
    status: 'sent',
  },
  {
    id: '4',
    recipientNumber: '+1444789012',
    messageType: 'pdf',
    content: 'invoice_march_2024.pdf',
    timestamp: new Date('2024-03-15T16:00:00'),
    status: 'pending',
  },
  {
    id: '5',
    recipientNumber: '+1333456789',
    messageType: 'text',
    content: 'Failed to deliver message',
    timestamp: new Date('2024-03-14T09:15:00'),
    status: 'failed',
  },
];

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Auth Services
export const authService = {
  async adminLogin(credentials: LoginCredentials): Promise<AuthUser | null> {
    await delay(500);
    if (credentials.username === ADMIN_CREDENTIALS.username && 
        credentials.password === ADMIN_CREDENTIALS.password) {
      return {
        id: 'admin',
        username: 'admin',
        role: 'admin',
        status: 'active',
      };
    }
    return null;
  },

  async userLogin(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await fetch(`${API_BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid credentials');
    }

    const data = await response.json();
    return {
      id: data.id || data.username,
      username: data.username,
      role: 'user',
      status: data.status || 'active',
      apiKey: data.apikey || data.apiKey,
    };
  },

  logout(): void {
    localStorage.removeItem('authUser');
  },

  getStoredUser(): AuthUser | null {
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  },

  storeUser(user: AuthUser): void {
    localStorage.setItem('authUser', JSON.stringify(user));
  },
};

// User Management Services (Admin)
export const userManagementService = {
  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/admin/users`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to fetch users');
    }

    return await response.json();
  },

  async createUser(username: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/admin/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to create user');
    }

    const newUser = await response.json();
    return newUser;
  },

  async deleteUser(username: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/delete-user/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to delete user');
    }

    return true;
  },

  async toggleUserStatus(userId: string): Promise<User | null> {
    await delay(300);
    const user = users.find(u => u.id === userId);
    if (user) {
      user.status = user.status === 'active' ? 'disabled' : 'active';
      return { ...user };
    }
    return null;
  },

  async resetPassword(userId: string, newPassword: string): Promise<boolean> {
    await delay(300);
    const user = users.find(u => u.id === userId);
    if (user) {
      user.password = newPassword;
      return true;
    }
    return false;
  },

  async resetSession(userId: string): Promise<boolean> {
    await delay(300);
    const user = users.find(u => u.id === userId);
    if (user) {
      user.sessionStatus = 'offline';
      return true;
    }
    return false;
  },
};

// WhatsApp Services (User)
export const whatsappService = {
  async getStatus(apiKey: string): Promise<SessionStatus> {
    await delay(200);
    const user = users.find(u => u.apiKey === apiKey);
    return user?.sessionStatus || 'offline';
  },

  async getQRCode(apiKey: string): Promise<{ qr?: string; status?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/qr`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to get QR code');
    }

    return await response.json();
  },

  async sendText(apiKey: string, payload: SendTextPayload): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: payload.number,
        message: payload.message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to send text message');
    }
  },

  async sendImage(apiKey: string, payload: SendMediaPayload): Promise<void> {
    const formData = new FormData();
    formData.append('number', payload.number);
    formData.append('caption', payload.caption || '');
    if (payload.file) {
      formData.append('file', payload.file);
    }

    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/send-image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to send image');
    }
  },

  async sendPDF(apiKey: string, payload: SendMediaPayload): Promise<void> {
    const formData = new FormData();
    formData.append('number', payload.number);
    formData.append('caption', payload.caption || '');
    if (payload.file) {
      formData.append('file', payload.file);
    }

    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/send-pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to send PDF');
    }
  },

  async getMessageCount(apiKey: string): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/message-count`);
    
    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.count || 0;
  },

  async getMessageHistory(apiKey: string): Promise<MessageHistory[]> {
    await delay(400);
    console.log(`[API] Fetching message history for ${apiKey}`);
    return [...messageHistory].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },
};
