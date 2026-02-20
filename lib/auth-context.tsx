import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isAuthenticated, login as storageLogin, register as storageRegister, logout as storageLogout, getProfile, getPrograms, getPRs, getClients, getNotifications, type UserProfile } from './storage';

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: 'coach' | 'client') => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isLoading: true,
  profile: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const prefetchData = useCallback(async () => {
    await Promise.all([
      getPrograms().catch(() => []),
      getPRs().catch(() => []),
      getClients().catch(() => []),
      getNotifications().catch(() => []),
    ]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const authed = await isAuthenticated();
        if (authed) {
          const prof = await getProfile();
          setProfile(prof);
          setIsLoggedIn(true);
          prefetchData();
        }
      } catch {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await storageLogin(email, password);
    setProfile(result.profile);
    setIsLoggedIn(true);
    prefetchData();
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, role: 'coach' | 'client') => {
    const result = await storageRegister(email, password, name, role);
    setProfile(result.profile);
    setIsLoggedIn(true);
    prefetchData();
  }, []);

  const logout = useCallback(async () => {
    await storageLogout();
    setProfile(null);
    setIsLoggedIn(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const prof = await getProfile();
      setProfile(prof);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, profile, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
