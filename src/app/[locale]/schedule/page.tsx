'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

interface Schedule {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  telescope?: string;
  isPublic: boolean;
  user: { name: string | null; email: string | null };
}

const TELESCOPES = [
  '25 cm Refractor',
  '16-inch Cassegrain',
  'Celestron 8 (No.1)',
  'Celestron 8 (No.2)',
  'Other',
];

export default function SchedulePage() {
  const t = useTranslations('schedule');
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    telescope: '',
    isPublic: false,
  });

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/schedule?filter=${filter}`);
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push(`/${locale}`);
    if (status === 'authenticated') fetchSchedules();
  }, [status, router, fetchSchedules, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({ title: '', description: '', date: '', startTime: '', endTime: '', telescope: '', isPublic: false });
      fetchSchedules();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    fetchSchedules();
  };

  const filterKeys = ['upcoming', 'all', 'past'] as const;

  if (status === 'loading') {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="flex items-start justify-between mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <p className="label mb-3">{t('label')}</p>
          <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>{t('title')}</h1>
        </div>
        <button onClick={() => setShowModal(true)} className="btn mt-6">
          {t('newSession')}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-6 mb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        {filterKeys.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="text-xs tracking-wider uppercase pb-3 border-b-2 transition-colors"
            style={{
              borderBottomColor: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--ink)' : 'var(--ink-faint)',
            }}
          >
            {t(f)}
          </button>
        ))}
      </div>

      {/* Schedule list */}
      {loading ? (
        <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('loadingSchedules')}</p>
      ) : schedules.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm mb-4" style={{ color: 'var(--ink-faint)' }}>{t('noSchedules')}</p>
          <button onClick={() => setShowModal(true)} className="btn">
            {t('addFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-px" style={{ background: 'var(--line)' }}>
          {schedules.map((s) => (
            <div
              key={s.id}
              className="px-6 py-5 flex items-start justify-between gap-4 transition-colors"
              style={{ background: 'var(--bg)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-warm)')}
              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg)')}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{s.title}</p>
                  {s.isPublic && (
                    <span className="text-xs px-2 py-0.5" style={{ color: 'var(--ink-faint)', border: '1px solid var(--line)' }}>
                      {t('public')}
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {new Date(s.date).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {' · '}
                  {s.startTime}–{s.endTime}
                  {s.telescope && ` · ${s.telescope}`}
                </p>
                {s.description && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--ink-muted)' }}>{s.description}</p>
                )}
                <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{s.user.name ?? s.user.email}</p>
              </div>
              {s.user.email === session?.user?.email && (
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs shrink-0 transition-colors"
                  style={{ color: 'var(--ink-faint)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#cc4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
                >
                  {t('delete')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowModal(false)} />
          <div
            className="relative w-full max-w-lg p-8 z-10"
            style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-light tracking-wider" style={{ color: 'var(--ink)' }}>
                {t('modalTitle')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-lg leading-none transition-colors"
                style={{ color: 'var(--ink-faint)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>{t('titleField')}</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder={t('titlePlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>{t('dateField')}</label>
                  <input
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>{t('telescopeField')}</label>
                  <select
                    className="input"
                    value={form.telescope}
                    onChange={e => setForm({ ...form, telescope: e.target.value })}
                  >
                    <option value="">{t('selectTelescope')}</option>
                    {TELESCOPES.map(tel => <option key={tel} value={tel}>{tel}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>{t('startField')}</label>
                  <input
                    type="time"
                    className="input"
                    value={form.startTime}
                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>{t('endField')}</label>
                  <input
                    type="time"
                    className="input"
                    value={form.endTime}
                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>{t('notesField')}</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={t('notesPlaceholder')}
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={e => setForm({ ...form, isPublic: e.target.checked })}
                  className="w-3.5 h-3.5"
                />
                <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{t('publicCheck')}</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="btn flex-1">
                  {submitting ? t('saving') : t('save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-outline flex-1"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
