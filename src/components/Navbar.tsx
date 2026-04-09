'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: clientSession } = useSession();
  // Use live client session image so avatar updates immediately after upload
  const avatarImage = clientSession?.user?.image ?? session?.user?.image;
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { href: `/${locale}`, label: t('home') },
    { href: `/${locale}/about`, label: t('about') },
    { href: `/${locale}/people`, label: t('people') },
    { href: `/${locale}/calendar`, label: t('calendar') },
    { href: `/${locale}/visit`, label: t('visit') },
    { href: `/${locale}/weather`, label: t('weather') },
  ];

  const switchLocale = () => {
    const otherLocale = locale === 'en' ? 'tw' : 'en';
    const newPath = pathname.replace(`/${locale}`, `/${otherLocale}`);
    router.push(newPath);
  };

  const isActive = (href: string) => pathname === href;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';

  const roleDisplayKey: Record<string, 'roleVisitor' | 'roleMember' | 'roleOperator' | 'roleManager'> = {
    PENDING: 'roleVisitor',
    MEMBER: 'roleMember',
    OPERATOR: 'roleOperator',
    MANAGER: 'roleManager',
    ADMIN: 'roleManager',
  };
  const roleLabel = role ? t(roleDisplayKey[role] ?? 'roleVisitor') : null;

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

        {/* Desktop links + Right controls */}
        <div className="hidden md:flex items-center gap-6">
          {/* Nav links */}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm tracking-wide transition-colors duration-150"
              style={{ color: isActive(link.href) ? 'var(--ink)' : 'var(--ink-faint)' }}
            >
              {link.label}
            </Link>
          ))}

          <span style={{ color: 'var(--line)' }}>|</span>

          {/* Lang toggle */}
          <button
            onClick={switchLocale}
            className="text-sm tracking-wide transition-colors duration-150"
            style={{ color: 'var(--ink-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
          >
            {locale === 'en' ? '中文' : 'EN'}
          </button>

          <span style={{ color: 'var(--line)' }}>|</span>

          {/* Dark mode toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-sm tracking-wide transition-colors duration-150"
            style={{ color: 'var(--ink-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? '○' : '●'}
          </button>

          <span style={{ color: 'var(--line)' }}>|</span>

          {/* Auth */}
          {session?.user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center transition-opacity duration-150"
                style={{ opacity: userMenuOpen ? 1 : 0.7 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => { if (!userMenuOpen) e.currentTarget.style.opacity = '0.7'; }}
              >
                {avatarImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarImage}
                    alt={session.user.name ?? 'User'}
                    style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{ background: 'var(--ink-faint)', color: 'var(--bg)' }}
                  >
                    {session.user.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-9 w-48 py-1 z-50"
                  style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
                >
                  <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--line)' }}>
                    {avatarImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarImage}
                        alt={session.user.name ?? 'User'}
                        className="rounded-full flex-shrink-0"
                        style={{ width: 32, height: 32, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                        style={{ background: 'var(--ink-faint)', color: 'var(--bg)' }}
                      >
                        {session.user.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {session.user.name}
                      </p>
                      {roleLabel && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                          {roleLabel}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/${locale}/dashboard`}
                    onClick={() => setUserMenuOpen(false)}
                    className="hover-bg block px-4 py-2 text-sm tracking-wide"
                    style={{ color: 'var(--ink-secondary)' }}
                  >
                    {t('portal')}
                  </Link>
                  {isAdmin && (
                    <Link
                      href={`/${locale}/admin`}
                      onClick={() => setUserMenuOpen(false)}
                      className="hover-bg block px-4 py-2 text-sm tracking-wide"
                      style={{ color: 'var(--ink-secondary)' }}
                    >
                      {t('admin')}
                    </Link>
                  )}
                  {isManager && (
                    <Link
                      href={`/${locale}/admin/events`}
                      onClick={() => setUserMenuOpen(false)}
                      className="hover-bg block px-4 py-2 text-sm tracking-wide"
                      style={{ color: 'var(--ink-secondary)' }}
                    >
                      {t('events')}
                    </Link>
                  )}
                  <div style={{ borderTop: '1px solid var(--line)', marginTop: '0.25rem' }}>
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut(); }}
                      className="hover-bg w-full text-left px-4 py-2 text-sm tracking-wide"
                      style={{ color: 'var(--ink-secondary)' }}
                    >
                      {t('signOut')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn('google', { callbackUrl: `/${locale}/dashboard` })}
              className="text-sm tracking-wide transition-colors duration-150"
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
              className="text-sm tracking-wide"
              style={{ color: 'var(--ink-secondary)' }}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
            <button onClick={switchLocale} className="text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>
              {locale === 'en' ? '中文' : 'EN'}
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
            {session?.user ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 mb-1">
                  {avatarImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarImage} alt={session.user.name ?? 'User'} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                  )}
                  <span className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{session.user.name}</span>
                </div>
                <Link href={`/${locale}/dashboard`} onClick={() => setMenuOpen(false)} className="text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>{t('portal')}</Link>
                {isAdmin && (
                  <Link href={`/${locale}/admin`} onClick={() => setMenuOpen(false)} className="text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>{t('admin')}</Link>
                )}
                {isManager && (
                  <Link href={`/${locale}/admin/events`} onClick={() => setMenuOpen(false)} className="text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>{t('events')}</Link>
                )}
                <button onClick={() => signOut()} className="text-left text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>{t('signOut')}</button>
              </div>
            ) : (
              <button onClick={() => signIn('google', { callbackUrl: `/${locale}/dashboard` })} className="text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>{t('signIn')}</button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
