import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  api,
  FlowForgeApiError,
  getStoredOrgId,
  getStoredTokens,
  setStoredOrgId,
  setStoredTokens,
} from '../api/client';
import type { Organization, User } from '../types/api';

interface AuthContextValue {
  user: User | null;
  organizations: Organization[];
  activeOrg: Organization | null;
  loading: boolean;
  backendReachable: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    full_name: string;
    password: string;
    organization_name?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => getStoredOrgId());
  const [loading, setLoading] = useState(true);
  const [backendReachable, setBackendReachable] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('flowforge_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('flowforge_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const refreshSession = useCallback(async () => {
    const tokens = getStoredTokens();
    if (!tokens?.access) {
      try {
        await api.health();
        setBackendReachable(true);
      } catch (err) {
        if (err instanceof FlowForgeApiError && err.isNetworkError) {
          setBackendReachable(false);
        }
      }
      setLoading(false);
      return;
    }

    try {
      const me = await api.me();
      setBackendReachable(true);
      setUser(me.user);
      setOrganizations(me.organizations);
      const currentId = getStoredOrgId();
      const matched = me.organizations.find((o) => o.id === currentId) || me.organizations[0] || null;
      if (matched) {
        setStoredOrgId(matched.id);
        setActiveOrgId(matched.id);
      }
    } catch (err) {
      if (err instanceof FlowForgeApiError && err.isNetworkError) {
        setBackendReachable(false);
      } else {
        setStoredTokens(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setStoredTokens(res.tokens);
    setUser(res.user);
    setOrganizations(res.organizations);
    const firstOrg = res.organizations[0] || null;
    if (firstOrg) {
      setStoredOrgId(firstOrg.id);
      setActiveOrgId(firstOrg.id);
    }
    setBackendReachable(true);
  };

  const register = async (payload: {
    email: string;
    full_name: string;
    password: string;
    organization_name?: string;
  }) => {
    const res = await api.register(payload);
    setStoredTokens(res.tokens);
    setUser(res.user);
    setOrganizations(res.organizations);
    const firstOrg = res.organizations[0] || null;
    if (firstOrg) {
      setStoredOrgId(firstOrg.id);
      setActiveOrgId(firstOrg.id);
    }
    setBackendReachable(true);
  };

  const logout = async () => {
    const tokens = getStoredTokens();
    if (tokens?.refresh) {
      try {
        await api.logout(tokens.refresh);
      } catch {
        // Proceed with local cleanup even if backend unreachable
      }
    }
    setStoredTokens(null);
    setStoredOrgId(null);
    setUser(null);
    setOrganizations([]);
    setActiveOrgId(null);
  };

  const switchOrganization = async (orgId: string) => {
    await api.switchOrganization(orgId);
    setStoredOrgId(orgId);
    setActiveOrgId(orgId);
  };

  const activeOrg = organizations.find((o) => o.id === activeOrgId) || organizations[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrg,
        loading,
        backendReachable,
        theme,
        toggleTheme,
        login,
        register,
        logout,
        switchOrganization,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
