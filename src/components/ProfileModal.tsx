'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AvatarCropper from '@/components/AvatarCropper';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const t = useTranslations('profile');
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  const [form, setForm] = useState({
    lastNameZh: '', firstNameZh: '',
    firstNameEn: '', lastNameEn: '',
    contactEmail: '',
    receiveEventEmails: true,
    bio: '',
    website: '',
    department: '',
    showPublicProfile: false,
    showPublicEmail: false,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'error' | 'saved'>('idle');

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCropSrc(null);
    setAvatarError(null);
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
          receiveEventEmails: data.receiveEventEmails !== false,
          bio: data.bio ?? '',
          website: data.website ?? '',
          department: data.department ?? '',
          showPublicProfile: data.showPublicProfile === true,
          showPublicEmail: data.showPublicEmail === true,
        });
        setAvatarUrl(session?.user?.image ?? null);
        setStatus('idle');
      });
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setAvatarError(t('avatarTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t('avatarSizeError'));
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append('avatar', blob, 'avatar.jpg');
    const res = await fetch('/api/auth/avatar', { method: 'POST', body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setAvatarUrl(url);
      await updateSession(); // forces JWT to re-read image from DB so useSession() stays fresh
      router.refresh(); // re-runs layout → reads new DB image → updates Navbar
    } else {
      setAvatarError(t('avatarUploadError'));
    }
    setUploadingAvatar(false);
  };

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

  const currentAvatar = avatarUrl ?? session?.user?.image;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={() => { if (!cropSrc) onClose(); }}
    >
      <div
        className="w-full max-w-2xl p-8 overflow-y-auto"
        style={{ background: 'var(--bg)', border: '1px solid var(--line)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {cropSrc ? (
          <>
            <p className="label mb-5">{t('cropTitle')}</p>
            <AvatarCropper
              src={cropSrc}
              onConfirm={handleCropConfirm}
              onCancel={() => setCropSrc(null)}
            />
          </>
        ) : (
          <>
            <p className="label mb-5">{t('title')}</p>

            {status === 'loading' ? (
              <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('loading')}</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">
                {/* Avatar row */}
                <div className="flex items-center gap-4 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFileChange} />
                  <div
                    className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 group"
                    style={{ background: 'var(--line)', cursor: uploadingAvatar ? 'default' : 'pointer' }}
                    onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
                  >
                    {currentAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={currentAvatar} src={currentAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-medium" style={{ color: 'var(--ink-faint)' }}>
                        {form.firstNameEn?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    {uploadingAvatar ? (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                        <span className="text-xs text-white">…</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: 'rgba(0,0,0,0.45)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>
                      {t('changePhoto')}
                    </button>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{t('avatarHint')}</p>
                    {avatarError && <p className="text-xs mt-0.5" style={{ color: '#cc4444' }}>{avatarError}</p>}
                  </div>
                </div>

                {/* Two-column body */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left — identity & contact */}
                  <div className="space-y-4">
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
                  </div>

                  {/* Right — public profile */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('bio')}</label>
                      <textarea
                        className="input resize-none"
                        rows={4}
                        maxLength={200}
                        value={form.bio}
                        onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                      />
                      <p className="text-xs mt-1 text-right" style={{ color: 'var(--ink-faint)' }}>{form.bio.length}/200</p>
                    </div>
                    <div>
                      <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('department')}</label>
                      <input className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder={t('departmentPlaceholder')} />
                    </div>
                    <div>
                      <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('website')}</label>
                      <input type="url" className="input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                    </div>
                    <div className="space-y-3 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.showPublicProfile} onChange={e => setForm(f => ({ ...f, showPublicProfile: e.target.checked }))} />
                        <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{t('showPublicProfile')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.showPublicEmail} onChange={e => setForm(f => ({ ...f, showPublicEmail: e.target.checked }))} />
                        <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{t('showPublicEmail')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.receiveEventEmails} onChange={e => setForm(f => ({ ...f, receiveEventEmails: e.target.checked }))} />
                        <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{t('receiveEventEmails')}</span>
                      </label>
                    </div>
                  </div>
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
          </>
        )}
      </div>
    </div>
  );
}
