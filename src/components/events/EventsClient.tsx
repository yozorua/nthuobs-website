'use client';

import { useState } from 'react';

interface Participant {
  id: string;
  user: {
    id: string;
    name: string | null;
    firstNameEn: string | null;
    lastNameEn: string | null;
    firstNameZh: string | null;
    lastNameZh: string | null;
    role: string;
    image: string | null;
  };
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  isPublic: boolean;
  maxParticipants: number | null;
  estimatedVisitors: number | null;
  participantCount: number;
  participating: boolean;
}

interface Props {
  upcoming: Event[];
  history: Event[];
  locale: string;
  t: {
    upcomingTab: string;
    historyTab: string;
    noUpcoming: string;
    noHistory: string;
    participate: string;
    withdraw: string;
    full: string;
    registered: string;
    participants: string;
    details: string;
    hideDetails: string;
    time: string;
    location: string;
    estimatedVisitors: string;
    alsoJoining: string;
    noOthers: string;
    loadingParticipants: string;
  };
}

export default function EventsClient({ upcoming: initialUpcoming, history, locale, t }: Props) {
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [upcoming, setUpcoming] = useState<Event[]>(initialUpcoming);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const dateLocale = locale === 'tw' ? 'zh-TW' : 'en-GB';
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [participantsCache, setParticipantsCache] = useState<Record<string, Participant[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState<string | null>(null);

  const toggle = async (ev: Event) => {
    setLoadingId(ev.id);
    try {
      const method = ev.participating ? 'DELETE' : 'POST';
      const res = await fetch(`/api/events/${ev.id}/participate`, { method });
      if (res.ok) {
        setUpcoming(prev => prev.map(e =>
          e.id === ev.id
            ? { ...e, participating: !e.participating, participantCount: e.participantCount + (e.participating ? -1 : 1) }
            : e
        ));
        // Refresh participants cache for this event if it's expanded
        if (expandedId === ev.id) loadParticipants(ev.id, true);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const loadParticipants = async (eventId: string, force = false) => {
    if (!force && participantsCache[eventId]) return;
    setLoadingParticipants(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipantsCache(prev => ({ ...prev, [eventId]: data }));
      }
    } finally {
      setLoadingParticipants(null);
    }
  };

  const toggleExpand = (ev: Event) => {
    if (expandedId === ev.id) {
      setExpandedId(null);
    } else {
      setExpandedId(ev.id);
      loadParticipants(ev.id);
    }
  };

  const isFull = (ev: Event) => ev.maxParticipants !== null && ev.participantCount >= ev.maxParticipants && !ev.participating;

  const spotLabel = (ev: Event) => {
    if (ev.maxParticipants === null) return `${ev.participantCount} ${t.participants}`;
    return `${ev.participantCount} / ${ev.maxParticipants}`;
  };

  const displayName = (u: Participant['user']) => {
    if (locale === 'tw' && (u.lastNameZh || u.firstNameZh)) {
      return `${u.lastNameZh ?? ''}${u.firstNameZh ?? ''}`;
    }
    if (u.firstNameEn || u.lastNameEn) return `${u.firstNameEn ?? ''} ${u.lastNameEn ?? ''}`.trim();
    return u.name ?? '—';
  };

  const formatTime = (ev: Event) => {
    if (!ev.startTime && !ev.endTime) return null;
    if (ev.startTime && ev.endTime) return `${ev.startTime} – ${ev.endTime}`;
    return ev.startTime ?? ev.endTime;
  };

  const renderEventDetail = (ev: Event, isHistory = false) => {
    const expanded = expandedId === ev.id;
    const pList = participantsCache[ev.id] ?? [];
    const others = pList.filter(p => p.user.id !== undefined); // all registered members
    const timeStr = formatTime(ev);

    return (
      <div key={ev.id} style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
        {/* Main row */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>{ev.title}</p>
            <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
              {new Date(ev.date).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {timeStr && <span> · {timeStr}</span>}
              {ev.location && <span> · {ev.location}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs" style={{ color: isFull(ev) ? '#cc4444' : ev.participating ? 'var(--ink-secondary)' : 'var(--ink-faint)' }}>
              {spotLabel(ev)}
            </span>
            <button
              onClick={() => toggleExpand(ev)}
              className="text-xs hover-link"
              style={{ color: 'var(--ink-faint)' }}
            >
              {expanded ? t.hideDetails : t.details}
            </button>
            {!isHistory && (
              ev.participating ? (
                <button
                  onClick={() => toggle(ev)}
                  disabled={loadingId === ev.id}
                  className="btn-outline text-xs px-4 py-2"
                  style={{ opacity: loadingId === ev.id ? 0.5 : 1 }}
                >
                  {loadingId === ev.id ? '…' : t.withdraw}
                </button>
              ) : (
                <button
                  onClick={() => toggle(ev)}
                  disabled={isFull(ev) || loadingId === ev.id}
                  className="btn text-xs px-4 py-2"
                  style={{ opacity: (isFull(ev) || loadingId === ev.id) ? 0.5 : 1, cursor: isFull(ev) ? 'not-allowed' : 'pointer' }}
                >
                  {loadingId === ev.id ? '…' : isFull(ev) ? t.full : t.participate}
                </button>
              )
            )}
            {isHistory && (
              <span className="text-xs tracking-ultra uppercase" style={{ color: 'var(--ink-faint)' }}>{t.registered}</span>
            )}
          </div>
        </div>

        {/* Expanded detail panel */}
        {expanded && (
          <div className="px-6 pb-6 pt-1" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-warm)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {timeStr && (
                <div>
                  <p className="text-xs tracking-ultra uppercase mb-1" style={{ color: 'var(--ink-faint)' }}>{t.time}</p>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{timeStr}</p>
                </div>
              )}
              {ev.location && (
                <div>
                  <p className="text-xs tracking-ultra uppercase mb-1" style={{ color: 'var(--ink-faint)' }}>{t.location}</p>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{ev.location}</p>
                </div>
              )}
              {ev.estimatedVisitors != null && (
                <div>
                  <p className="text-xs tracking-ultra uppercase mb-1" style={{ color: 'var(--ink-faint)' }}>{t.estimatedVisitors}</p>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{ev.estimatedVisitors}</p>
                </div>
              )}
              {ev.maxParticipants != null && (
                <div>
                  <p className="text-xs tracking-ultra uppercase mb-1" style={{ color: 'var(--ink-faint)' }}>{t.participants}</p>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{ev.participantCount} / {ev.maxParticipants}</p>
                </div>
              )}
            </div>

            {ev.description && (
              <div className="mb-5">
                <p className="text-xs tracking-ultra uppercase mb-2" style={{ color: 'var(--ink-faint)' }}>Description</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink-secondary)' }}>{ev.description}</p>
              </div>
            )}

            <div>
              <p className="text-xs tracking-ultra uppercase mb-3" style={{ color: 'var(--ink-faint)' }}>{t.alsoJoining}</p>
              {loadingParticipants === ev.id ? (
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t.loadingParticipants}</p>
              ) : others.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t.noOthers}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {others.map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                      {p.user.image ? (
                        <img src={p.user.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: 'var(--line)', color: 'var(--ink-secondary)' }}>
                          {(p.user.firstNameEn ?? p.user.name ?? '?')[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{displayName(p.user)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-6 mb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        {(['upcoming', 'history'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className="pb-3 text-sm tracking-wide"
            style={{
              color: tab === tabKey ? 'var(--ink)' : 'var(--ink-faint)',
              borderBottom: tab === tabKey ? '1px solid var(--ink)' : '1px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tabKey === 'upcoming' ? t.upcomingTab : t.historyTab}
          </button>
        ))}
      </div>

      {tab === 'upcoming' && (
        upcoming.length === 0
          ? <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t.noUpcoming}</p>
          : <div style={{ border: '1px solid var(--line)' }}>
              {upcoming.map(ev => renderEventDetail(ev, false))}
            </div>
      )}

      {tab === 'history' && (
        history.length === 0
          ? <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t.noHistory}</p>
          : <div style={{ border: '1px solid var(--line)' }}>
              {history.map(ev => renderEventDetail(ev, true))}
            </div>
      )}
    </>
  );
}
