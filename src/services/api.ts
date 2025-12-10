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

/* ============================
   AUTH SERVICE
============================ */
export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Invalid login credentials");
    }

    const data = await response.json();

    return {
      id: data.username,
      username: data.username,
      role: data.role || "user",
      status: data.status,
      apiKey: data.apikey,
    };
  },

  logout() {
    localStorage.removeItem("authUser");
  },

  getStoredUser(): AuthUser | null {
    return JSON.parse(localStorage.getItem("authUser") || "null");
  },

  storeUser(user: AuthUser) {
    localStorage.setItem("authUser", JSON.stringify(user));
  },
};

/* ============================
   USER MANAGEMENT SERVICE
============================ */
export const userManagementService = {
  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/admin/users`);
    const raw = await response.json();

    // backend returns an array, ensure frontend gets proper format
    return raw.map((u: any) => ({
      username: u.username,
      status: u.status,
      apikey: u.apikey,
      messagesToday: u.messagesToday,
      lastReset: u.lastReset,
    }));
  },

  createUser(username: string, password: string) {
    return fetch(`${API_BASE_URL}/admin/create-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  },

  deleteUser(username: string) {
    return fetch(`${API_BASE_URL}/admin/delete-user/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
  },

  toggleUserStatus(username: string) {
    return fetch(`${API_BASE_URL}/admin/toggle-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
  },

  resetPassword(username: string, newPassword: string) {
    return fetch(`${API_BASE_URL}/admin/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, newPassword }),
    });
  },

  resetSession(apiKey: string) {
    return fetch(`${API_BASE_URL}/admin/reset-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
  },
};

/* ============================
   WHATSAPP SERVICE
============================ */
export const whatsappService = {
  getStatus: (apiKey: string) =>
    fetch(`${API_BASE_URL}/api/${apiKey}/status`).then((r) => r.json()),

  getQRCode: (apiKey: string) =>
    fetch(`${API_BASE_URL}/api/${apiKey}/qr`).then((r) => r.json()),

  sendText: (apiKey: string, payload: SendTextPayload) =>
    fetch(`${API_BASE_URL}/api/${apiKey}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

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

  getMessageCount: (apiKey: string) =>
    fetch(`${API_BASE_URL}/api/${apiKey}/message-count`).then((r) => r.json()),

  async getMessageHistory(apiKey: string): Promise<MessageHistory[]> {
    return [];
  },
};
