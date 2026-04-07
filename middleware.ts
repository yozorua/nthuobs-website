import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import { auth } from './src/lib/auth';

const intlMiddleware = createMiddleware(routing);

const memberPaths = ['/dashboard', '/schedule'];
const adminPaths = ['/admin'];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameWithoutLocale = pathname.replace(/^\/(en|tw)/, '') || '/';
  const locale = pathname.match(/^\/(en|tw)/)?.[1] ?? 'en';

  const isMemberPath = memberPaths.some(p => pathnameWithoutLocale.startsWith(p));
  const isAdminPath = adminPaths.some(p => pathnameWithoutLocale.startsWith(p));

  if (isMemberPath || isAdminPath) {
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;

    if (!session?.user) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
    if (role === 'PENDING') {
      return NextResponse.redirect(new URL(`/${locale}/activate`, request.url));
    }
    if (isAdminPath && role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
