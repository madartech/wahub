import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    // Simple local validation (no backend auth yet)
    if (email && password) {
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
