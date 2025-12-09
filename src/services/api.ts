import { User, AuthUser, LoginCredentials, SendTextPayload, SendMediaPayload, SessionStatus } from '@/types';

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

  async userLogin(credentials: LoginCredentials): Promise<AuthUser | null> {
    await delay(500);
    const user = users.find(
      u => u.username === credentials.username && u.password === credentials.password
    );
    if (user) {
      return {
        id: user.id,
        username: user.username,
        role: 'user',
        status: user.status,
        apiKey: user.apiKey,
        sessionStatus: user.sessionStatus,
      };
    }
    return null;
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
    await delay(300);
    return [...users];
  },

  async createUser(username: string, password: string): Promise<User> {
    await delay(500);
    const newUser: User = {
      id: Date.now().toString(),
      username,
      password,
      status: 'active',
      apiKey: `api_key_${Math.random().toString(36).substring(2, 15)}`,
      messageCount: 0,
      sessionStatus: 'offline',
      createdAt: new Date(),
    };
    users.push(newUser);
    return newUser;
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

  async getQRCode(apiKey: string): Promise<string> {
    await delay(300);
    // Return a placeholder QR code data URL
    return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=whatsapp-connect-${apiKey}`;
  },

  async sendText(apiKey: string, payload: SendTextPayload): Promise<boolean> {
    await delay(500);
    console.log(`[API] Sending text to ${payload.number}: ${payload.message}`);
    return true;
  },

  async sendImage(apiKey: string, payload: SendMediaPayload): Promise<boolean> {
    await delay(800);
    console.log(`[API] Sending image to ${payload.number} with caption: ${payload.caption}`);
    return true;
  },

  async sendPDF(apiKey: string, payload: SendMediaPayload): Promise<boolean> {
    await delay(800);
    console.log(`[API] Sending PDF to ${payload.number} with caption: ${payload.caption}`);
    return true;
  },
};
