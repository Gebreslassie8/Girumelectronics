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
    try {
      const cached = localStorage.getItem('user');
      if (!cached || cached === 'undefined' || cached === 'null') {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
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
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    setLoading(false);
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

  const login = async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password }),
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