import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  authPost,
  setUnauthorizedHandler,
  clearTokenStorage,
  getRefreshToken,
} from '@/lib/api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  corporate_id?: string;
  phone_country?: string;
  phone_number?: string;
  status?: 'invited' | 'active' | 'disabled';
  caregiver_type?: string;
  caregiver_subtype?: string;
  address?: string;
}

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; role?: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ── Force-logout (called by the 401 handler) ──────────────────────────────
  // Clears everything and redirects. Does NOT call the API — avoids the
  // circular dependency where logout→401→logout→…
  const forceLogout = useCallback(() => {
    clearTokenStorage();
    setUser(null);
    setUserRole(null);
    navigate('/auth');
  }, [navigate]);

  // ── User-initiated sign out ────────────────────────────────────────────────
  // Clears local state first, navigates, then best-effort revokes on server.
  const signOut = useCallback(async () => {
    const rt = getRefreshToken();
    clearTokenStorage();
    setUser(null);
    setUserRole(null);
    navigate('/auth');
    // Fire-and-forget: revoke the refresh token on the server
    if (rt) {
      try { await authPost('/auth/logout', { refreshToken: rt }); } catch { /* ignore */ }
    }
  }, [navigate]);

  // Register the global 401 handler (runs when both tokens are dead)
  useEffect(() => {
    setUnauthorizedHandler(forceLogout);
  }, [forceLogout]);

  // ── Session restore on mount ───────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('aisla_access_token');
    const savedUser = localStorage.getItem('aisla_user');

    if (!token || !savedUser) {
      setLoading(false);
      return;
    }

    // Optimistically restore from localStorage …
    try {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setUserRole(parsed.role);
    } catch {
      clearTokenStorage();
      setLoading(false);
      return;
    }

    // … then validate against the server (will silently refresh if needed)
    api.get('/auth/me')
      .then((data: unknown) => {
        const u = data as User;
        setUser(u);
        setUserRole(u.role);
        localStorage.setItem('aisla_user', JSON.stringify(u));
        localStorage.setItem('aisla_role', u.role);
      })
      .catch(() => {
        // Token is dead and refresh also failed → forceLogout already ran
        clearTokenStorage();
        setUser(null);
        setUserRole(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sign in ────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    try {
      const raw = await authPost('/auth/login', { email, password });
      const data = raw as { accessToken: string; refreshToken: string; user: User };
      localStorage.setItem('aisla_access_token', data.accessToken);
      localStorage.setItem('aisla_refresh_token', data.refreshToken);
      localStorage.setItem('aisla_user', JSON.stringify(data.user));
      localStorage.setItem('aisla_role', data.user.role);
      setUser(data.user);
      setUserRole(data.user.role);
      return { error: null, role: data.user.role };
    } catch (err: any) {
      return { error: { message: err.message }, role: null };
    }
  };

  // ── Sign up ────────────────────────────────────────────────────────────────
  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    try {
      const raw = await authPost('/auth/signup', { email, password, full_name: fullName, role });
      const data = raw as { accessToken: string; refreshToken: string; user: User };
      localStorage.setItem('aisla_access_token', data.accessToken);
      localStorage.setItem('aisla_refresh_token', data.refreshToken);
      localStorage.setItem('aisla_user', JSON.stringify(data.user));
      localStorage.setItem('aisla_role', data.user.role);
      setUser(data.user);
      setUserRole(data.user.role);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message } };
    }
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
