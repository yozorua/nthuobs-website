import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'NTHU Observatory', template: '%s — NTHU Observatory' },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'tw')) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const session = await auth();

  // Always read role and name from DB so Navbar reflects true state (not stale JWT)
  if (session?.user?.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, firstNameEn: true, lastNameEn: true, firstNameZh: true, lastNameZh: true },
    });
    if (dbUser) {
      (session.user as { role?: string }).role = dbUser.role;
      const displayName = locale === 'tw'
        ? (dbUser.lastNameZh && dbUser.firstNameZh ? `${dbUser.lastNameZh}${dbUser.firstNameZh}` : null)
        : (dbUser.firstNameEn && dbUser.lastNameEn ? `${dbUser.firstNameEn} ${dbUser.lastNameEn}` : null);
      if (displayName) (session.user as { name?: string | null }).name = displayName;
    }
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <SessionProvider session={session}>
          <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
            <Navbar session={session} locale={locale} />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </SessionProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
