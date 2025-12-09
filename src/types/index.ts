export type UserRole = 'admin' | 'user';

export type UserStatus = 'active' | 'disabled';

export type SessionStatus = 'online' | 'offline' | 'qr_pending';

export interface User {
  id: string;
  username: string;
  password: string;
  status: UserStatus;
  apiKey: string;
  messageCount: number;
  sessionStatus: SessionStatus;
  createdAt: Date;
}

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  apiKey?: string;
  sessionStatus?: SessionStatus;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SendTextPayload {
  number: string;
  message: string;
}

export interface SendMediaPayload {
  number: string;
  file: File;
  caption: string;
}
