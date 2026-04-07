'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';

export default function ActivatePage() {
  const t = useTranslations('activate');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { update } = useSession();

  const [passkey, setPasskey] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    const res = await fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey }),
    });

    if (res.ok) {
      setStatus('success');
      // Force session refresh so role updates to MEMBER
      await update();
      setTimeout(() => router.push(`/${locale}/dashboard`), 1200);
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="page-enter min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-10">
          <p className="label mb-3">{t('label')}</p>
          <h1 className="text-2xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            {t('title')}
          </h1>
        </div>

        <div className="mb-6 p-5" style={{ border: '1px solid var(--line)', background: 'var(--bg-warm)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
            {t('desc')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            className="input font-mono"
            placeholder={t('placeholder')}
            value={passkey}
            onChange={e => setPasskey(e.target.value)}
            disabled={status === 'submitting' || status === 'success'}
            autoFocus
            required
          />

          {status === 'error' && (
            <p className="text-xs" style={{ color: '#cc4444' }}>{t('error')}</p>
          )}
          {status === 'success' && (
            <p className="text-xs" style={{ color: '#44aa66' }}>{t('success')}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={status === 'submitting' || status === 'success' || !passkey.trim()}
              className="btn flex-1"
            >
              {status === 'submitting' ? t('submitting') : t('submit')}
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${locale}` })}
              className="btn-outline"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
