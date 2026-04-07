import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import { auth } from './src/lib/auth';

const intlMiddleware = createMiddleware(routing);

const protectedPaths = ['/dashboard', '/schedule'];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip locale prefix to get the bare path
  const pathnameWithoutLocale = pathname.replace(/^\/(en|tw)/, '') || '/';
  const locale = pathname.match(/^\/(en|tw)/)?.[1] ?? 'en';

  const isProtected = protectedPaths.some(p => pathnameWithoutLocale.startsWith(p));

  if (isProtected) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
    // Pending users must activate first
    if (session.user.role === 'PENDING' && !pathnameWithoutLocale.startsWith('/activate')) {
      return NextResponse.redirect(new URL(`/${locale}/activate`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
