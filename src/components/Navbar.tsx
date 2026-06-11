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
  const [servicesOpen, setServicesOpen] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const servicesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openServices = () => {
    if (servicesTimerRef.current) clearTimeout(servicesTimerRef.current);
    setServicesOpen(true);
  };
  const closeServices = () => {
    servicesTimerRef.current = setTimeout(() => setServicesOpen(false), 180);
  };
  const closeMenu = () => {
    setMenuOpen(false);
    setServicesExpanded(false);
    setAccountExpanded(false);
  };
  const { theme, setTheme } = useTheme();
  const { data: clientSession } = useSession();
  // Prefer live client session so avatar updates immediately after upload without a full reload
  const avatarImage = clientSession?.user?.image ?? session?.user?.image;
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { href: `/${locale}/about`, label: t('about') },
    { href: `/${locale}/people`, label: t('people') },
    { href: `/${locale}/calendar`, label: t('calendar') },
    { href: `/${locale}/visit`, label: t('visit') },
    { href: `/${locale}/gallery`, label: t('gallery') },
    { href: `/${locale}/weather`, label: t('weather') },
  ];

  const serviceLinks = [
    { href: `/${locale}/services/plate-solve`, label: t('plateSolve') },
    { href: `/${locale}/services/planetarium`, label: t('planetarium') },
    { href: `/${locale}/services/tonights-sky`, label: t('tonightsSky') },
  ];
  const isServicesActive = serviceLinks.some(l => pathname === l.href);

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
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const isMember = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'].includes(role ?? '');

  const roleDisplayKey: Record<string, 'roleVisitor' | 'roleMember' | 'roleOperator' | 'roleManager'> = {
    PENDING: 'roleVisitor',
    MEMBER: 'roleMember',
    OPERATOR: 'roleOperator',
    MANAGER: 'roleManager',
    ADMIN: 'roleManager',
  };
  const roleLabel = role ? t(roleDisplayKey[role] ?? 'roleVisitor') : null;

  return (
    <>
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--nav-border)',
        backdropFilter: 'blur(24px) saturate(200%)',
        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
      }}
    >
      <nav className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center group">
          {pathname.includes('/weather') ? (
            <Image
              src="/banner_light.png"
              alt="NTHU Observatory"
              width={7217}
              height={1134}
              className="h-7 md:h-8 w-auto opacity-75 group-hover:opacity-100 transition-opacity"
            />
          ) : (
            <>
              <Image
                src="/banner_light.png"
                alt="NTHU Observatory"
                width={7217}
                height={1134}
                className="hidden dark:block h-7 md:h-8 w-auto opacity-75 group-hover:opacity-100 transition-opacity"
              />
              <Image
                src="/banner_dark.png"
                alt="NTHU Observatory"
                width={7217}
                height={1134}
                className="block dark:hidden h-7 md:h-8 w-auto opacity-75 group-hover:opacity-100 transition-opacity"
              />
            </>
          )}
        </Link>

        {/* Desktop links + Right controls */}
        <div className="hidden md:flex items-center gap-6">
          {/* Nav links */}
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm tracking-wide transition-all duration-150 pb-0.5"
                style={{
                  color: active ? 'var(--ink)' : 'var(--ink-faint)',
                  borderBottom: active ? '1px solid var(--ink)' : '1px solid transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--ink)';
                  e.currentTarget.style.borderBottomColor = 'var(--ink)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = active ? 'var(--ink)' : 'var(--ink-faint)';
                  e.currentTarget.style.borderBottomColor = active ? 'var(--ink)' : 'transparent';
                }}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Services dropdown */}
          <div
            className="relative"
            ref={servicesRef}
            onMouseEnter={openServices}
            onMouseLeave={closeServices}
          >
            <button
              className="flex items-center gap-1 text-sm tracking-wide transition-all duration-150 pb-0.5"
              style={{
                color: isServicesActive || servicesOpen ? 'var(--ink)' : 'var(--ink-faint)',
                borderBottom: isServicesActive ? '1px solid var(--ink)' : '1px solid transparent',
              }}
            >
              {t('services')}
              <span
                style={{
                  fontSize: '0.55rem',
                  opacity: 0.5,
                  display: 'inline-block',
                  transition: 'transform 0.15s',
                  transform: servicesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▾
              </span>
            </button>

            {servicesOpen && (
              <div
                className="absolute left-0 z-50"
                style={{
                  top: 'calc(100% + 10px)',
                  minWidth: 200,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
                  animation: 'navDropdownIn 0.15s ease-out',
                }}
                onMouseEnter={openServices}
                onMouseLeave={closeServices}
              >
                <p className="px-4 pt-3 pb-2 text-xs tracking-widest uppercase" style={{ color: 'var(--ink-faint)' }}>
                  {t('services')}
                </p>
                <div style={{ borderTop: '1px solid var(--line)' }} />
                {serviceLinks.map(link => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setServicesOpen(false)}
                      className="hover-bg flex items-center gap-3 px-4 py-3 text-sm tracking-wide"
                      style={{ color: active ? 'var(--ink)' : 'var(--ink-secondary)' }}
                    >
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: active ? 'var(--ink)' : 'var(--line-dark)',
                      }} />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

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
            suppressHydrationWarning
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
                  style={pathname.includes('/weather') ? {
                    background: '#111111',
                    border: '1px solid #2a2a2a',
                    ['--bg' as string]: '#111111',
                    ['--bg-warm' as string]: '#181818',
                    ['--ink' as string]: '#e8e8e6',
                    ['--ink-secondary' as string]: '#aaaaaa',
                    ['--ink-faint' as string]: '#555555',
                    ['--line' as string]: '#2a2a2a',
                  } : { background: 'var(--bg)', border: '1px solid var(--line)' }}
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
                  {isMember && (
                    <Link
                      href={`/${locale}/dashboard/events`}
                      onClick={() => setUserMenuOpen(false)}
                      className="hover-bg block px-4 py-2 text-sm tracking-wide"
                      style={{ color: 'var(--ink-secondary)' }}
                    >
                      {t('events')}
                    </Link>
                  )}
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
                      {t('manageEvents')}
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

    </header>

      {/* Mobile full-screen overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-[200] flex flex-col"
          style={{ background: 'var(--bg)', animation: 'mobileOverlayIn 0.22s ease-out' }}
        >
          {/* Header row */}
          <div
            className="flex items-center justify-between px-6 flex-shrink-0"
            style={{ height: 56, borderBottom: '1px solid var(--line)' }}
          >
            <Link href={`/${locale}`} onClick={closeMenu} className="flex items-center group">
              {pathname.includes('/weather') ? (
                <Image src="/banner_light.png" alt="NTHU Observatory" width={7217} height={1134} className="h-7 w-auto opacity-75" />
              ) : (
                <>
                  <Image src="/banner_light.png" alt="NTHU Observatory" width={7217} height={1134} className="hidden dark:block h-7 w-auto opacity-75" />
                  <Image src="/banner_dark.png" alt="NTHU Observatory" width={7217} height={1134} className="block dark:hidden h-7 w-auto opacity-75" />
                </>
              )}
            </Link>
            <button
              onClick={closeMenu}
              className="flex items-center justify-center p-1"
              aria-label="Close menu"
              style={{ color: 'var(--ink-faint)', fontSize: '1.25rem', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Nav links */}
            {navLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="flex items-center justify-between px-6"
                style={{
                  height: 56,
                  borderBottom: '1px solid var(--line)',
                  color: isActive(link.href) ? 'var(--ink)' : 'var(--ink-secondary)',
                  fontSize: '0.9375rem',
                  letterSpacing: '0.04em',
                  animation: `navItemIn 0.25s ease-out ${0.04 + i * 0.035}s both`,
                }}
              >
                {link.label}
                {isActive(link.href) && (
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ink)', flexShrink: 0 }} />
                )}
              </Link>
            ))}

            {/* Services accordion */}
            <button
              onClick={() => setServicesExpanded(!servicesExpanded)}
              className="flex items-center justify-between w-full px-6"
              style={{
                height: 56,
                borderBottom: '1px solid var(--line)',
                color: isServicesActive ? 'var(--ink)' : 'var(--ink-secondary)',
                fontSize: '0.9375rem',
                letterSpacing: '0.04em',
                animation: `navItemIn 0.25s ease-out ${0.04 + navLinks.length * 0.035}s both`,
              }}
            >
              {t('services')}
              <span style={{ fontSize: '0.5rem', opacity: 0.4, display: 'inline-block', transition: 'transform 0.2s', transform: servicesExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {servicesExpanded && (
              <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-warm)' }}>
                {serviceLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-8"
                    style={{
                      height: 52,
                      borderBottom: '1px solid var(--line)',
                      color: isActive(link.href) ? 'var(--ink)' : 'var(--ink-secondary)',
                      fontSize: '0.875rem',
                      letterSpacing: '0.03em',
                    }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: isActive(link.href) ? 'var(--ink)' : 'var(--line-dark)', flexShrink: 0 }} />
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Language + theme toggles */}
            <div
              className="flex items-center gap-3 px-6"
              style={{ height: 60, borderBottom: '1px solid var(--line)' }}
            >
              <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <button
                  onClick={() => locale !== 'en' && switchLocale()}
                  className="text-xs tracking-wider"
                  style={{ padding: '0.375rem 0.75rem', background: locale === 'en' ? 'var(--ink)' : 'transparent', color: locale === 'en' ? 'var(--bg)' : 'var(--ink-faint)', transition: 'all 0.15s' }}
                >EN</button>
                <button
                  onClick={() => locale !== 'tw' && switchLocale()}
                  className="text-xs tracking-wider"
                  style={{ padding: '0.375rem 0.75rem', background: locale === 'tw' ? 'var(--ink)' : 'transparent', color: locale === 'tw' ? 'var(--bg)' : 'var(--ink-faint)', transition: 'all 0.15s' }}
                >中文</button>
              </div>
              <div suppressHydrationWarning style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <button
                  onClick={() => theme !== 'light' && setTheme('light')}
                  className="text-xs tracking-wider"
                  style={{ padding: '0.375rem 0.75rem', background: theme === 'light' ? 'var(--ink)' : 'transparent', color: theme === 'light' ? 'var(--bg)' : 'var(--ink-faint)', transition: 'all 0.15s' }}
                >Light</button>
                <button
                  onClick={() => theme !== 'dark' && setTheme('dark')}
                  className="text-xs tracking-wider"
                  style={{ padding: '0.375rem 0.75rem', background: theme === 'dark' ? 'var(--ink)' : 'transparent', color: theme === 'dark' ? 'var(--bg)' : 'var(--ink-faint)', transition: 'all 0.15s' }}
                >Dark</button>
              </div>
            </div>

            {/* Account section */}
            {session?.user ? (
              <>
                <button
                  onClick={() => setAccountExpanded(!accountExpanded)}
                  className="flex items-center justify-between w-full px-6"
                  style={{ height: 56, borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)', fontSize: '0.9375rem', letterSpacing: '0.04em' }}
                >
                  <span className="flex items-center gap-2.5">
                    {avatarImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarImage} alt={session.user.name ?? 'User'} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: 'var(--ink-faint)', color: 'var(--bg)' }}>
                        {session.user.name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}
                    {session.user.name}
                  </span>
                  <span style={{ fontSize: '0.5rem', opacity: 0.4, display: 'inline-block', transition: 'transform 0.2s', transform: accountExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
                {accountExpanded && (
                  <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-warm)' }}>
                    <Link href={`/${locale}/dashboard`} onClick={closeMenu} className="flex items-center px-8 text-sm tracking-wide" style={{ height: 52, borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>{t('portal')}</Link>
                    {isMember && (
                      <Link href={`/${locale}/dashboard/events`} onClick={closeMenu} className="flex items-center px-8 text-sm tracking-wide" style={{ height: 52, borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>{t('events')}</Link>
                    )}
                    {isAdmin && (
                      <Link href={`/${locale}/admin`} onClick={closeMenu} className="flex items-center px-8 text-sm tracking-wide" style={{ height: 52, borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>{t('admin')}</Link>
                    )}
                    {isManager && (
                      <Link href={`/${locale}/admin/events`} onClick={closeMenu} className="flex items-center px-8 text-sm tracking-wide" style={{ height: 52, borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>{t('manageEvents')}</Link>
                    )}
                    <button onClick={() => { closeMenu(); signOut(); }} className="flex items-center w-full px-8 text-sm tracking-wide" style={{ height: 52, color: 'var(--ink-secondary)' }}>{t('signOut')}</button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => signIn('google', { callbackUrl: `/${locale}/dashboard` })}
                className="flex items-center w-full px-6"
                style={{ height: 56, borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)', fontSize: '0.9375rem', letterSpacing: '0.04em' }}
              >
                {t('signIn')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
