'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';

const ROLES = ['PENDING', 'MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL_KEY: Record<Role, string> = {
  PENDING: 'rolePending',
  MEMBER: 'roleMember',
  OPERATOR: 'roleOperator',
  MANAGER: 'roleManager',
  ADMIN: 'roleAdmin',
};

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
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
  const [role, setRole] = useState<Role>(user.role as Role);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isSelf = user.id === currentUserId;

  const displayName = () => {
    if (locale === 'tw' && (user.lastNameZh || user.firstNameZh)) {
      return `${user.lastNameZh ?? ''}${user.firstNameZh ?? ''}`;
    }
    if (user.firstNameEn || user.lastNameEn) {
      return `${user.firstNameEn ?? ''} ${user.lastNameEn ?? ''}`.trim();
    }
    return user.name ?? '—';
  };

  const handleRoleChange = async (newRole: Role) => {
    if (newRole === role) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) setRole(newRole);
    } finally {
      setSaving(false);
    }
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

  const roleColor: Record<Role, string> = {
    PENDING: 'var(--ink-faint)',
    MEMBER: 'var(--ink-secondary)',
    OPERATOR: 'var(--ink)',
    MANAGER: 'var(--ink)',
    ADMIN: 'var(--ink)',
  };

  const dateLocale = locale === 'tw' ? 'zh-TW' : 'en-GB';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_160px_120px_60px] gap-2 md:gap-4 px-5 py-4 items-center" style={{ background: 'var(--bg)' }}>
      {/* Name */}
      <div className="flex items-center gap-2.5">
        {user.image ? (
          <Image src={user.image} alt={user.name ?? ''} width={24} height={24} className="rounded-full shrink-0" />
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

      {/* Role select */}
      <select
        value={role}
        onChange={e => handleRoleChange(e.target.value as Role)}
        disabled={saving || isSelf}
        className="text-xs tracking-ultra uppercase px-2 py-1.5 transition-opacity"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          color: roleColor[role],
          opacity: saving ? 0.5 : 1,
          cursor: isSelf ? 'not-allowed' : 'pointer',
        }}
      >
        {ROLES.map(r => (
          <option key={r} value={r}>{t(ROLE_LABEL_KEY[r])}</option>
        ))}
      </select>

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
