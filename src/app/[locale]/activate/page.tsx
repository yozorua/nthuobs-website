'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function ActivatePage() {
  const t = useTranslations('activate');
  const params = useParams();
  const locale = params.locale as string;
  const { data: session, update } = useSession();

  const [step, setStep] = useState<'passkey' | 'profile'>('passkey');

  // Step 1 state
  const [passkey, setPasskey] = useState('');
  const [passkeyStatus, setPasskeyStatus] = useState<'idle' | 'submitting' | 'error'>('idle');

  // Step 2 state
  const [form, setForm] = useState({
    lastNameZh: '', firstNameZh: '',
    firstNameEn: '', lastNameEn: '',
    contactEmail: session?.user?.email ?? '',
    phone: '',
  });
  const [profileStatus, setProfileStatus] = useState<'idle' | 'submitting' | 'error'>('idle');

  const handlePasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyStatus('submitting');
    const res = await fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey }),
    });
    if (res.ok) {
      setForm(f => ({ ...f, contactEmail: session?.user?.email ?? '' }));
      setStep('profile');
    } else {
      setPasskeyStatus('error');
    }
  };

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus('submitting');
    const res = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      await update();
      window.location.href = `/${locale}/dashboard`;
    } else {
      setProfileStatus('error');
    }
  };

  return (
    <div className="page-enter min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {step === 'passkey' && (
          <>
            <div className="mb-10">
              <p className="label mb-3">{t('label')}</p>
              <h1 className="text-2xl font-light" style={{ color: 'var(--ink)' }}>{t('title')}</h1>
            </div>
            <div className="mb-6 p-5" style={{ border: '1px solid var(--line)', background: 'var(--bg-warm)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{t('desc')}</p>
            </div>
            <form onSubmit={handlePasskey} className="space-y-4">
              <input
                type="text"
                className="input font-mono"
                placeholder={t('placeholder')}
                value={passkey}
                onChange={e => setPasskey(e.target.value)}
                disabled={passkeyStatus === 'submitting'}
                autoFocus
                required
              />
              {passkeyStatus === 'error' && (
                <p className="text-xs" style={{ color: '#cc4444' }}>{t('error')}</p>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={passkeyStatus === 'submitting' || !passkey.trim()} className="btn flex-1">
                  {passkeyStatus === 'submitting' ? t('submitting') : t('submit')}
                </button>
                <button type="button" onClick={() => signOut({ callbackUrl: `/${locale}` })} className="btn-outline">
                  {t('cancel')}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'profile' && (
          <>
            <div className="mb-10">
              <p className="label mb-3">{t('profileLabel')}</p>
              <h1 className="text-2xl font-light" style={{ color: 'var(--ink)' }}>{t('profileTitle')}</h1>
            </div>
            <div className="mb-6 p-5" style={{ border: '1px solid var(--line)', background: 'var(--bg-warm)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{t('profileDesc')}</p>
            </div>
            <form onSubmit={handleProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('lastNameZh')}</label>
                  <input className="input" value={form.lastNameZh} onChange={e => setForm(f => ({ ...f, lastNameZh: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('firstNameZh')}</label>
                  <input className="input" value={form.firstNameZh} onChange={e => setForm(f => ({ ...f, firstNameZh: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('firstNameEn')}</label>
                  <input className="input" value={form.firstNameEn} onChange={e => setForm(f => ({ ...f, firstNameEn: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('lastNameEn')}</label>
                  <input className="input" value={form.lastNameEn} onChange={e => setForm(f => ({ ...f, lastNameEn: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('contactEmail')}</label>
                <input type="email" className="input" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('phone')}</label>
                <input type="tel" className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" pattern="[0-9]*" required />
              </div>
              {profileStatus === 'error' && (
                <p className="text-xs" style={{ color: '#cc4444' }}>{t('profileError')}</p>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={profileStatus === 'submitting'} className="btn flex-1">
                  {profileStatus === 'submitting' ? t('confirming') : t('confirm')}
                </button>
                <button type="button" onClick={() => setStep('passkey')} className="btn-outline">
                  {t('back')}
                </button>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
