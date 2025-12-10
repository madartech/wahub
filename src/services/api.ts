import {
  User,
  AuthUser,
  LoginCredentials,
  SendTextPayload,
  SendMediaPayload,
  SessionStatus,
  MessageHistory,
} from "@/types";

const API_BASE_URL = "https://api.madarivms.com";

// ------------------------------
// AUTH SERVICES
// ------------------------------
export const authService = {
  async adminLogin(credentials: LoginCredentials): Promise<AuthUser | null> {
    if (credentials.username === "admin" && credentials.password === "admin123") {
      return {
        id: "admin",
        username: "admin",
        role: "admin",
        status: "active",
      };
    }
    return null;
  },

  async userLogin(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await fetch(`${API_BASE_URL}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Invalid login credentials");
    }

    const data = await response.json();

    return {
      id: data.username,
      username: data.username,
      role: "user",
      status: data.status || "active",
      apiKey: data.apikey,
    };
  },

  logout() {
    localStorage.removeItem("authUser");
  },

  getStoredUser(): AuthUser | null {
    const stored = localStorage.getItem("authUser");
    return stored ? JSON.parse(stored) : null;
  },

  storeUser(user: AuthUser) {
    localStorage.setItem("authUser", JSON.stringify(user));
  },
};

// ------------------------------
// USER MANAGEMENT SERVICES
// ------------------------------
export const userManagementService = {
  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/admin/users`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to fetch users");
    }

    const data = await response.json();

    // Backend returns an object { username: { details } }
    if (typeof data === "object" && !Array.isArray(data)) {
      return Object.entries(data).map(([username, info]: any) => ({
        id: username,
        username,
        password: info.password,
        status: info.status || "active",
        apiKey: info.apikey,
        messageCount: info.messagesToday || 0,
        sessionStatus: info.session || "offline",
        createdAt: new Date(),
      }));
    }

    return [];
  },

  async createUser(username: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/admin/create-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to create user");
    }

    return await response.json();
  },

  async deleteUser(username: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/delete-user/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete user");
    }

    return true;
  },

  async toggleUserStatus(username: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/toggle-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to toggle user status");
    }

    return true;
  },

  async resetPassword(username: string, newPassword: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        newPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to reset password");
    }

    return true;
  },

  async resetSession(apiKey: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/reset-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to reset session");
    }

    return true;
  },
};

// ------------------------------
// WHATSAPP SERVICE
// ------------------------------
export const whatsappService = {
  async getStatus(apiKey: string): Promise<SessionStatus> {
    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/status`);
    if (!response.ok) return "offline";

    const data = await response.json();
    return data.status || "offline";
  },

  async getQRCode(apiKey: string) {
    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/qr`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to get QR code");
    }

    return await response.json();
  },

  async sendText(apiKey: string, payload: SendTextPayload) {
    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to send text message");
    }
  },

  async sendImage(apiKey: string, payload: SendMediaPayload) {
    const formData = new FormData();
    formData.append("number", payload.number);
    formData.append("caption", payload.caption || "");
    if (payload.file) formData.append("file", payload.file);

    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/send-image`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Failed to send image");
  },

  async sendPDF(apiKey: string, payload: SendMediaPayload) {
    const formData = new FormData();
    formData.append("number", payload.number);
    formData.append("caption", payload.caption || "");
    if (payload.file) formData.append("file", payload.file);

    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/send-pdf`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Failed to send PDF");
  },

  async getMessageCount(apiKey: string): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/api/${apiKey}/message-count`);
    if (!response.ok) return 0;

    const data = await response.json();
    return data.count || 0;
  },

  async getMessageHistory(apiKey: string): Promise<MessageHistory[]> {
    return [];
  },
};
