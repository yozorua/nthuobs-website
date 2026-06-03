'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

export type PublicUser = {
  id: string;
  name: string | null;
  image: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  firstNameZh: string | null;
  lastNameZh: string | null;
  role: string;
  contactEmail: string | null;
  bio: string | null;
  website: string | null;
  department: string | null;
  showPublicProfile: boolean;
  updatedAt: Date;
};

function displayName(user: PublicUser, locale: string) {
  const en = [user.firstNameEn, user.lastNameEn].filter(Boolean).join(' ') || user.name || 'Unknown';
  const zh = [user.lastNameZh, user.firstNameZh].filter(Boolean).join('') || null;
  if (locale === 'tw' && zh) return { primary: zh, secondary: en };
  return { primary: en, secondary: zh };
}

function roleLabel(role: string, t: ReturnType<typeof useTranslations>) {
  const map: Record<string, string> = {
    MANAGER: t('managersLabel'),
    OPERATOR: t('operatorsLabel'),
    MEMBER: t('membersLabel'),
    ADMIN: t('managersLabel'),
  };
  return map[role] ?? role;
}

function Avatar({ image, initials, size = 64 }: { image?: string | null; initials: string; size?: number }) {
  if (image) {
    return (
      <div className="shrink-0 overflow-hidden" style={{ width: size, height: size, border: '1px solid var(--line)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" width={size} height={size} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex items-center justify-center shrink-0 font-light"
      style={{ width: size, height: size, background: 'var(--bg-muted)', border: '1px solid var(--line)', color: 'var(--ink-faint)', fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

function ProfilePopup({ user, locale, onClose }: { user: PublicUser; locale: string; onClose: () => void }) {
  const t = useTranslations('people');
  const ref = useRef<HTMLDivElement>(null);
  const { primary, secondary } = displayName(user, locale);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const sep = user.image?.includes('?') ? '&' : '?';
  const imageUrl = user.image ? `${user.image}${sep}t=${new Date(user.updatedAt).getTime()}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div
        ref={ref}
        className="relative w-full max-w-sm p-8"
        style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
      >
        {/* X close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center transition-opacity duration-150"
          style={{ color: 'var(--ink-faint)', opacity: 0.6 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-5 mb-6">
          <Avatar image={imageUrl} initials={primary.charAt(0).toUpperCase()} size={72} />
          <div className="min-w-0">
            <p className="text-lg font-medium leading-tight" style={{ color: 'var(--ink)' }}>{primary}</p>
            {secondary && <p className="text-sm mt-0.5" style={{ color: 'var(--ink-faint)' }}>{secondary}</p>}
            <p className="text-sm mt-1" style={{ color: 'var(--ink-secondary)' }}>{roleLabel(user.role, t)}</p>
            {user.department && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--ink-faint)' }}>{user.department}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4 text-sm" style={{ borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
          {user.contactEmail && (
            <div>
              <p className="text-xs tracking-ultra uppercase mb-1" style={{ color: 'var(--ink-faint)' }}>{t('popupEmail')}</p>
              <a href={`mailto:${user.contactEmail}`} className="hover-link" style={{ color: 'var(--ink-secondary)' }}>
                {user.contactEmail}
              </a>
            </div>
          )}
          {user.bio && (
            <div>
              <p className="text-xs tracking-ultra uppercase mb-1" style={{ color: 'var(--ink-faint)' }}>{t('popupBio')}</p>
              <p className="leading-relaxed" style={{ color: 'var(--ink-secondary)', whiteSpace: 'pre-wrap' }}>{user.bio}</p>
            </div>
          )}
          {user.website && (
            <div>
              <p className="text-xs tracking-ultra uppercase mb-1" style={{ color: 'var(--ink-faint)' }}>{t('popupWebsite')}</p>
              <a
                href={user.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover-link truncate block"
                style={{ color: 'var(--ink-secondary)' }}
              >
                {user.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberCard({ user, locale }: { user: PublicUser; locale: string }) {
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { primary, secondary } = displayName(user, locale);
  const initials = primary.charAt(0).toUpperCase();
  const sep = user.image?.includes('?') ? '&' : '?';
  const imageUrl = user.image ? `${user.image}${sep}t=${new Date(user.updatedAt).getTime()}` : null;
  const clickable = user.showPublicProfile;

  const handleMouseEnter = () => {
    if (!clickable) return;
    hoverTimer.current = setTimeout(() => setOpen(true), 300);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  return (
    <>
      <div
        className="relative p-5 flex flex-col items-center text-center gap-3"
        style={{
          background: 'var(--bg)',
          width: '10rem',
          border: '1px solid var(--line)',
          cursor: clickable ? 'pointer' : 'default',
        }}
        onClick={() => clickable && setOpen(true)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Avatar image={imageUrl} initials={initials} size={64} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{primary}</p>
          {secondary && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{secondary}</p>}
        </div>

        {/* Arrow indicator at bottom-right of card */}
        {clickable && (
          <div className="absolute bottom-2 right-2" style={{ color: 'var(--ink-faint)', opacity: 0.5 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 11 L11 2" />
              <path d="M5 2 L11 2 L11 8" />
            </svg>
          </div>
        )}
      </div>
      {open && <ProfilePopup user={user} locale={locale} onClose={() => setOpen(false)} />}
    </>
  );
}

export function MemberGrid({ users, emptyLabel, locale }: { users: PublicUser[]; emptyLabel: string; locale: string }) {
  if (users.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-px">
      {users.map(u => <MemberCard key={u.id} user={u} locale={locale} />)}
    </div>
  );
}
