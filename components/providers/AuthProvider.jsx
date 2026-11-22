'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load user from localStorage on mount — SAFE
  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const clearStorage = () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    };

    try {
      const cached = localStorage.getItem('user');
      if (!cached || cached === 'undefined' || cached === 'null') {
        clearStorage();
      } else {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && parsed._id) {
          setUser(parsed);
        } else {
          localStorage.removeItem('user');
        }
      }
    } catch (err) {
      console.warn('[AuthProvider] bad cached user, clearing:', err.message);
      clearStorage();
    }

    // Optional background refresh if /api/auth/me exists and cookie is valid
    apiFetch('/auth/me')
      .then((me) => {
        if (cancelled) return;
        const resolvedUser = me?.user || (me?._id ? me : null);
        if (resolvedUser && resolvedUser._id) {
          setUser(resolvedUser);
          localStorage.setItem('user', JSON.stringify(resolvedUser));
        }
      })
      .catch(() => {
        // Ignore if /auth/me isn't used or session is unauthenticated
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(next));
      }
      return next;
    });
  };

  const login = async (email, password, rememberMe = true) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        rememberMe: Boolean(rememberMe),
      }),
    });

    if (!data || !data.user || !data.token) {
      throw new Error(data?.error || 'Login failed — no user in response');
    }

    setUser(data.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
    }
    router.push('/dashboard');
    router.refresh();
    return data.user;
  };

  const signup = async (payload) => {
    const normalizedPayload = {
      ...payload,
      ...(payload?.email ? { email: String(payload.email).trim().toLowerCase() } : {}),
    };
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    });

    if (!data || !data.user || !data.token) {
      throw new Error(data?.error || 'Registration failed — no user in response');
    }

    setUser(data.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
    }
    router.push('/dashboard');
    router.refresh();
    return data.user;
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    router.push('/login');
  };

  return (
    <AuthCtx.Provider
      value={{ user, setUser, updateUser, login, signup, logout, loading }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
export default AuthProvider;