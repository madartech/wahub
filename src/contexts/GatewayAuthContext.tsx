import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ADMIN_EMAIL, ADMIN_LOGIN_PASSWORD } from '@/config/gateway';

interface GatewayAuthContextType {
  isLoggedIn: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const GatewayAuthContext = createContext<GatewayAuthContextType | undefined>(undefined);

export function GatewayAuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('loggedIn') === 'true';
  });

  const login = (email: string, password: string): boolean => {
    // Validated against the configured admin credentials (see src/config/gateway.ts).
    // Note: this only gates the dashboard UI — it does not replace proper backend-verified
    // sessions, since the API admin token is still bundled in the client build.
    const emailOk = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const passwordOk = password === ADMIN_LOGIN_PASSWORD;
    if (emailOk && passwordOk) {
      localStorage.setItem('loggedIn', 'true');
      setIsLoggedIn(true);
      return true;
    }
    return false;
  };


  const logout = () => {
    localStorage.removeItem('loggedIn');
    setIsLoggedIn(false);
  };

  return (
    <GatewayAuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </GatewayAuthContext.Provider>
  );
}

export function useGatewayAuth() {
  const context = useContext(GatewayAuthContext);
  if (!context) {
    throw new Error('useGatewayAuth must be used within a GatewayAuthProvider');
  }
  return context;
}
