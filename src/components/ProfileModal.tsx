'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const t = useTranslations('profile');
  const [form, setForm] = useState({
    lastNameZh: '', firstNameZh: '',
    firstNameEn: '', lastNameEn: '',
    contactEmail: '', phone: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'error' | 'saved'>('idle');

  useEffect(() => {
    if (!open) return;
    setStatus('loading');
    fetch('/api/auth/profile')
      .then(r => r.json())
      .then(data => {
        setForm({
          lastNameZh: data.lastNameZh ?? '',
          firstNameZh: data.firstNameZh ?? '',
          firstNameEn: data.firstNameEn ?? '',
          lastNameEn: data.lastNameEn ?? '',
          contactEmail: data.contactEmail ?? '',
          phone: data.phone ?? '',
        });
        setStatus('idle');
      });
  }, [open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setStatus(res.ok ? 'saved' : 'error');
    if (res.ok) setTimeout(onClose, 800);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose}>
      <div className="w-full max-w-sm p-8" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
        <p className="label mb-5">{t('title')}</p>

        {status === 'loading' ? (
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('loading')}</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('lastNameZh')}</label>
                <input className="input" value={form.lastNameZh} onChange={e => setForm(f => ({ ...f, lastNameZh: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('firstNameZh')}</label>
                <input className="input" value={form.firstNameZh} onChange={e => setForm(f => ({ ...f, firstNameZh: e.target.value }))} />
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
            {status === 'error' && <p className="text-xs" style={{ color: '#cc4444' }}>{t('error')}</p>}
            {status === 'saved' && <p className="text-xs" style={{ color: '#44aa66' }}>{t('saved')}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={status === 'saving' || status === 'saved'} className="btn flex-1">
                {status === 'saving' ? t('saving') : t('save')}
              </button>
              <button type="button" onClick={onClose} className="btn-outline">{t('cancel')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
