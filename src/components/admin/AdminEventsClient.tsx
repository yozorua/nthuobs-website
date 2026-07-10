'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Participant {
  id: string;
  user: {
    id: string;
    name: string | null;
    firstNameEn: string | null;
    lastNameEn: string | null;
    firstNameZh: string | null;
    lastNameZh: string | null;
    email: string;
    role: string;
    image: string | null;
  };
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  isPublic: boolean;
  maxParticipants: number | null;
  estimatedVisitors: number | null;
  participantCount: number;
}

interface Props {
  initialEvents: Event[];
  locale: string;
}

const DEFAULT_LOCATION = '清大天文台';
const emptyForm = {
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  location: DEFAULT_LOCATION,
  isPublic: true,
  maxParticipants: '',
  estimatedVisitors: '',
};

export default function AdminEventsClient({ initialEvents, locale }: Props) {
  const t = useTranslations('adminEvents');
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendAnnouncement, setSendAnnouncement] = useState(false);

  const [participantsEvent, setParticipantsEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const dateLocale = locale === 'tw' ? 'zh-TW' : 'en-GB';
  const roleLabels: Record<string, string> = {
    PENDING: t('rolePending'),
    MEMBER: t('roleMember'),
    OPERATOR: t('roleOperator'),
    MANAGER: t('roleManager'),
    ADMIN: t('roleAdmin'),
    WEB_MANAGER: t('roleWebManager'),
    MASCOT: t('roleMascot'),
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSendAnnouncement(true); setShowModal(true); };
  const openEdit = (ev: Event) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      date: new Date(ev.date).toISOString().split('T')[0],
      startTime: ev.startTime ?? '',
      endTime: ev.endTime ?? '',
      location: ev.location ?? DEFAULT_LOCATION,
      isPublic: ev.isPublic,
      maxParticipants: ev.maxParticipants?.toString() ?? '',
      estimatedVisitors: ev.estimatedVisitors?.toString() ?? '',
    });
    setShowModal(true);
  };

  const openParticipants = async (ev: Event) => {
    setParticipantsEvent(ev);
    setLoadingParticipants(true);
    try {
      const res = await fetch(`/api/admin/events/${ev.id}/participants`);
      if (res.ok) setParticipants(await res.json());
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/admin/events/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const updated = await res.json();
          setEvents(prev => prev.map(ev => ev.id === updated.id ? updated : ev));
          setShowModal(false);
        }
      } else {
        const res = await fetch('/api/admin/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, sendAnnouncement }),
        });
        if (res.ok) {
          const created = await res.json();
          setEvents(prev => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
          setShowModal(false);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
      if (res.ok) setEvents(prev => prev.filter(ev => ev.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const displayName = (u: Participant['user']) => {
    if (locale === 'tw' && (u.lastNameZh || u.firstNameZh)) {
      return `${u.lastNameZh ?? ''}${u.firstNameZh ?? ''}`;
    }
    if (u.firstNameEn && u.lastNameEn) return `${u.firstNameEn} ${u.lastNameEn}`;
    return u.name ?? u.email;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <button onClick={openCreate} className="btn">{t('newEvent')}</button>
      </div>

      {events.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('noEvents')}</p>
      ) : (
        <div style={{ border: '1px solid var(--line)' }}>
          <div
            className="hidden md:grid grid-cols-[1fr_160px_140px_80px_100px_80px] gap-4 px-5 py-3 text-xs tracking-ultra uppercase"
            style={{ color: 'var(--ink-faint)', borderBottom: '1px solid var(--line)', background: 'var(--bg-warm)' }}
          >
            <span>{t('colTitle')}</span>
            <span>{t('colDateTime')}</span>
            <span>{t('colLocation')}</span>
            <span>{t('colVisibility')}</span>
            <span>{t('colParticipants')}</span>
            <span></span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {events.map(ev => (
              <div key={ev.id} className="grid grid-cols-1 md:grid-cols-[1fr_160px_140px_80px_100px_80px] gap-2 md:gap-4 px-5 py-4 items-center" style={{ background: 'var(--bg)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{ev.title}</p>
                  {ev.estimatedVisitors != null && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{t('estVisitorsRow', { n: ev.estimatedVisitors })}</p>
                  )}
                </div>
                <div>
                  <span className="text-xs block" style={{ color: 'var(--ink-secondary)' }}>
                    {new Date(ev.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {(ev.startTime || ev.endTime) && (
                    <span className="text-xs block mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                      {ev.startTime ?? '?'}–{ev.endTime ?? '?'}
                    </span>
                  )}
                </div>
                <span className="text-xs truncate" style={{ color: 'var(--ink-faint)' }}>{ev.location ?? '—'}</span>
                <span className="text-xs tracking-ultra uppercase" style={{ color: ev.isPublic ? 'var(--ink-secondary)' : 'var(--ink-faint)' }}>
                  {ev.isPublic ? t('public') : t('private')}
                </span>
                <button
                  onClick={() => openParticipants(ev)}
                  className="text-xs hover-link text-left"
                  style={{ color: 'var(--ink-secondary)' }}
                >
                  {ev.participantCount}{ev.maxParticipants ? ` / ${ev.maxParticipants}` : ''}
                  {ev.participantCount > 0 && <span className="ml-1" style={{ color: 'var(--ink-faint)' }}>↗</span>}
                </button>
                <div className="flex gap-3">
                  <button onClick={() => openEdit(ev)} className="text-xs hover-link" style={{ color: 'var(--ink-faint)' }}>{t('edit')}</button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="text-xs"
                    style={{ color: '#cc4444', opacity: deletingId === ev.id ? 0.5 : 1 }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md p-8 overflow-y-auto" style={{ background: 'var(--bg)', border: '1px solid var(--line)', maxHeight: '90vh' }}>
            <p className="label mb-4">{editing ? t('modalEdit') : t('modalCreate')}</p>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldTitle')}</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldDate')}</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldStartTime')}</label>
                  <input type="time" className="input" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldEndTime')}</label>
                  <input type="time" className="input" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldLocation')}</label>
                <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldMaxMembers')}</label>
                  <input type="number" min="1" className="input" placeholder={t('unlimited')} value={form.maxParticipants} onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldEstVisitors')}</label>
                  <input type="number" min="0" className="input" placeholder="—" value={form.estimatedVisitors} onChange={e => setForm(f => ({ ...f, estimatedVisitors: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>{t('fieldDescription')}</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />
                <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{t('fieldPublic')}</span>
              </label>
              {!editing && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sendAnnouncement} onChange={e => setSendAnnouncement(e.target.checked)} />
                  <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{t('fieldAnnouncement')}</span>
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn flex-1">{saving ? t('saving') : t('save')}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">{t('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participants modal */}
      {participantsEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg p-8" style={{ background: 'var(--bg)', border: '1px solid var(--line)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="label">{t('participantsTitle')}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{participantsEvent.title}</p>
                {(participantsEvent.startTime || participantsEvent.endTime) && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                    {new Date(participantsEvent.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{participantsEvent.startTime ?? '?'}–{participantsEvent.endTime ?? '?'}
                  </p>
                )}
              </div>
              <button onClick={() => setParticipantsEvent(null)} className="text-xs hover-link shrink-0 ml-4" style={{ color: 'var(--ink-faint)' }}>{t('participantsClose')}</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingParticipants ? (
                <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('participantsLoading')}</p>
              ) : participants.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('participantsEmpty')}</p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {participants.map((p, i) => (
                    <div key={p.id} className="py-3 flex items-center gap-3">
                      <span className="text-xs w-5 text-right shrink-0" style={{ color: 'var(--ink-faint)' }}>{i + 1}</span>
                      {p.user.image ? (
                        <img src={p.user.image} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: 'var(--bg-warm)', color: 'var(--ink-secondary)' }}>
                          {(p.user.firstNameEn ?? p.user.name ?? p.user.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>{displayName(p.user)}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--ink-faint)' }}>{p.user.email}</p>
                      </div>
                      <span className="text-xs tracking-ultra uppercase shrink-0" style={{ color: 'var(--ink-faint)' }}>
                        {roleLabels[p.user.role] ?? p.user.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 mt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                {t('footerRegistered', { n: participants.length })}
                {participantsEvent.maxParticipants ? ` · ${t('footerMax', { n: participantsEvent.maxParticipants })}` : ''}
                {participantsEvent.estimatedVisitors != null ? ` · ${t('footerEstVisitors', { n: participantsEvent.estimatedVisitors })}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
