'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

const PRIMARY_ROLES = ['PENDING', 'MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'] as const;
const EXTRA_ROLES = ['WEB_MANAGER', 'MASCOT'] as const;
type PrimaryRole = typeof PRIMARY_ROLES[number];
type ExtraRole = typeof EXTRA_ROLES[number];

const ROLE_LABEL_KEY: Record<PrimaryRole | ExtraRole, string> = {
  PENDING: 'rolePending',
  MEMBER: 'roleMember',
  OPERATOR: 'roleOperator',
  MANAGER: 'roleManager',
  ADMIN: 'roleAdmin',
  WEB_MANAGER: 'roleWebManager',
  MASCOT: 'roleMascot',
};

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  extraRoles: string[];
  createdAt: Date;
  firstNameEn: string | null;
  lastNameEn: string | null;
  firstNameZh: string | null;
  lastNameZh: string | null;
}

interface Props {
  user: User;
  currentUserId: string;
}

export default function UserRoleRow({ user, currentUserId }: Props) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [role, setRole] = useState<PrimaryRole>(user.role as PrimaryRole);
  const [extraRoles, setExtraRoles] = useState<ExtraRole[]>(user.extraRoles as ExtraRole[]);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isSelf = user.id === currentUserId;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = () => {
    if (locale === 'tw' && (user.lastNameZh || user.firstNameZh)) {
      return `${user.lastNameZh ?? ''}${user.firstNameZh ?? ''}`;
    }
    if (user.firstNameEn || user.lastNameEn) {
      return `${user.firstNameEn ?? ''} ${user.lastNameEn ?? ''}`.trim();
    }
    return user.name ?? '—';
  };

  const saveRoles = async (newRole: PrimaryRole, newExtra: ExtraRole[]) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, extraRoles: newExtra }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryChange = (r: PrimaryRole) => {
    if (isSelf) return;
    setRole(r);
    saveRoles(r, extraRoles);
  };

  const handleExtraToggle = (r: ExtraRole) => {
    if (isSelf) return;
    const next = extraRoles.includes(r) ? extraRoles.filter(x => x !== r) : [...extraRoles, r];
    setExtraRoles(next);
    saveRoles(role, next);
  };

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) setDeleted(true);
    } finally {
      setDeleting(false);
    }
  };

  if (deleted) return null;

  const roleColor: Record<PrimaryRole, string> = {
    PENDING: 'var(--ink-faint)',
    MEMBER: 'var(--ink-secondary)',
    OPERATOR: 'var(--ink)',
    MANAGER: 'var(--ink)',
    ADMIN: 'var(--ink)',
  };

  const dateLocale = locale === 'tw' ? 'zh-TW' : 'en-GB';

  const roleLabel = (r: PrimaryRole | ExtraRole) => t(ROLE_LABEL_KEY[r]);

  const badgeText = [
    t(ROLE_LABEL_KEY[role]),
    ...extraRoles.map(r => t(ROLE_LABEL_KEY[r as ExtraRole])),
  ].join(', ');

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_160px_150px_60px] gap-2 md:gap-4 px-5 py-4 items-center" style={{ background: 'var(--bg)' }}>
      {/* Name */}
      <div className="flex items-center gap-2.5">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name ?? ''} width={24} height={24} className="rounded-full shrink-0" style={{ objectFit: 'cover' }} />
        ) : (
          <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs" style={{ background: 'var(--line)', color: 'var(--ink-secondary)' }}>
            {(user.firstNameEn ?? user.name ?? user.email)?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>
          {displayName()}
          {isSelf && <span className="ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>{t('you')}</span>}
        </span>
      </div>

      {/* Email */}
      <span className="text-xs truncate" style={{ color: 'var(--ink-secondary)' }}>{user.email}</span>

      {/* Joined */}
      <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
        {new Date(user.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>

      {/* Role multi-checkbox dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => !isSelf && setOpen(o => !o)}
          disabled={saving}
          className="text-xs tracking-ultra uppercase px-2 py-1.5 w-full text-left transition-opacity flex items-center justify-between gap-1"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            color: roleColor[role],
            opacity: saving ? 0.5 : 1,
            cursor: isSelf ? 'not-allowed' : 'pointer',
          }}
        >
          <span className="truncate">{badgeText}</span>
          {!isSelf && <span style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>▾</span>}
        </button>

        {open && (
          <div
            className="absolute z-20 right-0 mt-1 py-2 min-w-[160px]"
            style={{ background: 'var(--bg)', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          >
            {/* Primary roles */}
            <p className="px-3 pb-1 text-xs" style={{ color: 'var(--ink-faint)' }}>{t('rolePrimarySection')}</p>
            {PRIMARY_ROLES.map(r => (
              <label key={r} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-bg">
                <input
                  type="radio"
                  name={`role-${user.id}`}
                  checked={role === r}
                  onChange={() => handlePrimaryChange(r)}
                  style={{ accentColor: 'var(--ink)' }}
                />
                <span className="text-xs tracking-ultra uppercase" style={{ color: roleColor[r] }}>{roleLabel(r)}</span>
              </label>
            ))}

            {/* Extra roles */}
            <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--line)' }}>
              <p className="px-3 pb-1 text-xs" style={{ color: 'var(--ink-faint)' }}>{t('roleExtraSection')}</p>
              {EXTRA_ROLES.map(r => (
                <label key={r} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-bg">
                  <input
                    type="checkbox"
                    checked={extraRoles.includes(r)}
                    onChange={() => handleExtraToggle(r)}
                    style={{ accentColor: 'var(--ink)' }}
                  />
                  <span className="text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>{roleLabel(r)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="flex justify-end">
        {!isSelf && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs transition-opacity"
            style={{ color: '#cc4444', opacity: deleting ? 0.5 : 1 }}
          >
            {deleting ? t('deleting') : t('delete')}
          </button>
        )}
      </div>
    </div>
  );
}
