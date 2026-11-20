// lib/auth.js
import { cookies } from 'next/headers';
import { verifyToken } from './jwt';
import connectDB from './db';
import { User } from '@/models';

/**
 * Read the current user from the httpOnly cookie or Authorization header.
 * Returns null if not authenticated.
 */
export async function getUserFromRequest(req) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('token')?.value;

  const header = req.headers.get('authorization') || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;

  const token = cookieToken || bearerToken;
  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    if (!payload?.sub) return null;

    await connectDB();
    const user = await User.findById(payload.sub).select('-password').lean();
    if (!user || !user.isActive) return null;

    return user;
  } catch {
    return null;
  }
}

/**
 * Require an authenticated user.
 * Returns { ok: true, user } on success.
 * Returns { ok: false, status, user: null, error: Response } on failure.
 *
 * Compatible with BOTH patterns:
 *   const auth = await requireAuth(req);
 *   if (!auth.ok) return auth.error;
 *
 *   // OR legacy:
 *   const { error } = await requireAuth(req);
 *   if (error) return error;
 */
export async function requireAuth(req) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return {
      ok: false,
      status: 401,
      user: null,
      error: Response.json({ error: 'መግቢያ ያስፈልጋል' }, { status: 401 }),
    };
  }
  return { ok: true, user, error: null };
}

/**
 * Require an authenticated user with one of the given roles.
 */
export async function requireRole(req, ...roles) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;

  if (!roles.includes(auth.user.role)) {
    return {
      ok: false,
      status: 403,
      user: null,
      error: Response.json({ error: 'ፍቃድ የለዎትም' }, { status: 403 }),
    };
  }
  return { ok: true, user: auth.user, error: null };
}