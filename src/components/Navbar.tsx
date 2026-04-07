'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

interface NavbarProps {
  session: Session | null;
  locale: string;
}

export default function Navbar({ session, locale }: NavbarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const navLinks = [
    { href: `/${locale}`, label: t('home') },
    { href: `/${locale}/about`, label: t('about') },
    { href: `/${locale}/people`, label: t('people') },
    { href: `/${locale}/calendar`, label: t('calendar') },
    { href: `/${locale}/visit`, label: t('visit') },
  ];

  const switchLocale = () => {
    const otherLocale = locale === 'en' ? 'tw' : 'en';
    const newPath = pathname.replace(`/${locale}`, `/${otherLocale}`);
    router.push(newPath);
  };

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-50" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <nav className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <Image
            src="/logo_icon.png"
            alt="NTHU Observatory"
            width={22}
            height={22}
            className="opacity-75 group-hover:opacity-100 transition-opacity"
          />
          <span className="text-sm font-medium tracking-wider" style={{ color: 'var(--ink)' }}>
            NTHU Observatory
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs tracking-ultra uppercase transition-colors duration-150"
              style={{ color: isActive(link.href) ? 'var(--ink)' : 'var(--ink-faint)' }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right controls */}
        <div className="hidden md:flex items-center gap-4">
          {/* Lang toggle */}
          <button
            onClick={switchLocale}
            className="text-xs tracking-ultra uppercase transition-colors duration-150"
            style={{ color: 'var(--ink-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
          >
            {locale === 'en' ? '中文' : 'EN'}
          </button>

          {/* Divider */}
          <span style={{ color: 'var(--line)' }}>|</span>

          {/* Dark mode toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-xs tracking-ultra uppercase transition-colors duration-150"
            style={{ color: 'var(--ink-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? '○' : '●'}
          </button>

          {/* Divider */}
          <span style={{ color: 'var(--line)' }}>|</span>

          {/* Auth */}
          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href={`/${locale}/dashboard`}
                className="text-xs tracking-ultra uppercase transition-colors duration-150"
                style={{ color: 'var(--ink-faint)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
              >
                {t('portal')}
              </Link>
              <button
                onClick={() => signOut()}
                className="text-xs tracking-ultra uppercase transition-colors duration-150"
                style={{ color: 'var(--ink-faint)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
              >
                {t('signOut')}
              </button>
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? 'User'}
                  width={26}
                  height={26}
                  className="rounded-full"
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="text-xs tracking-ultra uppercase transition-colors duration-150"
              style={{ color: 'var(--ink-faint)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
            >
              {t('signIn')}
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-1"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-px transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} style={{ background: 'var(--ink)' }} />
          <span className={`block w-5 h-px transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} style={{ background: 'var(--ink)' }} />
          <span className={`block w-5 h-px transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} style={{ background: 'var(--ink)' }} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-6 py-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-xs tracking-ultra uppercase"
              style={{ color: 'var(--ink-secondary)' }}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
            <button onClick={switchLocale} className="text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>
              {locale === 'en' ? '中文' : 'EN'}
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
            {session?.user ? (
              <div className="flex flex-col gap-3">
                <Link href={`/${locale}/dashboard`} onClick={() => setMenuOpen(false)} className="text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>{t('portal')}</Link>
                <button onClick={() => signOut()} className="text-left text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>{t('signOut')}</button>
              </div>
            ) : (
              <button onClick={() => signIn('google')} className="text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>{t('signIn')}</button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
