import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/magic-link',
  '/api/auth/verify',
  '/api/waitlist',
  '/client-portal/login',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths (including Next.js internals)
  if (
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith('/_next'))
  ) {
    return NextResponse.next();
  }

  // Allow client-auth API routes without auth
  if (pathname.startsWith('/api/client-auth')) {
    return NextResponse.next();
  }

  // Client portal: require CLIENT role
  if (pathname.startsWith('/client-portal')) {
    const token = req.cookies.get('sf_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/client-portal/login', req.url));
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.role !== 'CLIENT') {
        return NextResponse.redirect(new URL('/client-portal/login', req.url));
      }
      // Attach user info to headers for server components
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', payload.sub as string);
      requestHeaders.set('x-user-role', payload.role as string);
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch {
      const response = NextResponse.redirect(new URL('/client-portal/login', req.url));
      response.cookies.delete('sf_token');
      return response;
    }
  }

  // Admin dashboard: require valid token (role ADMIN or CLIENT both ok)
  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get('sf_token')?.value;
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('sf_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/client-portal/:path*'],
};