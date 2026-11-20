// proxy.js
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { verifyToken } from '@/lib/jwt';

const intlMiddleware = createMiddleware(routing);

export default async function proxy(req) {
  const { pathname } = req.nextUrl;

  // 1. Locale handling first (adds /en or /am prefix if missing)
  const intlResponse = intlMiddleware(req);

  // 2. Auth check only for dashboard paths
  //    Matches /en/dashboard, /am/dashboard, /en/dashboard/..., etc.
  const isDashboard = /^\/(en|am)?\/?dashboard(\/|$)/.test(pathname);
  if (!isDashboard) return intlResponse;

  const token = req.cookies.get('token')?.value;
  const locale = pathname.split('/')[1] || 'en';

  // 3. No token → redirect to login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // 4. Invalid/expired token → clear cookie + redirect
  const payload = await verifyToken(token);
  if (!payload?.sub) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    const res = NextResponse.redirect(url);
    res.cookies.set('token', '', { maxAge: 0, path: '/' });
    return res;
  }

  // 5. Auth ok → continue with intl response
  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};