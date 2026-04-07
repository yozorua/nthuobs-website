'use client';

import { useState } from 'react';
import Image from 'next/image';

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Schedule {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  telescope: string | null;
  isPublic: boolean;
  userId: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

const TELESCOPES = ['25 cm Refractor', '16″ Cassegrain', 'Celestron 8 (A)', 'Celestron 8 (B)'];

const emptyForm = {
  title: '', description: '', date: '', startTime: '', endTime: '',
  telescope: '', isPublic: false, userId: '',
};

export default function AdminScheduleClient({
  initialSchedules,
  users,
}: {
  initialSchedules: Schedule[];
  users: User[];
}) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, userId: users[0]?.id ?? '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming');

  const now = new Date();
  const filtered = schedules.filter(s => {
    const d = new Date(s.date);
    if (filter === 'upcoming') return d >= now;
    if (filter === 'past') return d < now;
    return true;
  });

  const openCreate = () => {
    setForm({ ...emptyForm, userId: users[0]?.id ?? '' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const created = await res.json();
        setSchedules(prev => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setShowModal(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
      if (res.ok) setSchedules(prev => prev.filter(s => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-4">
          {(['upcoming', 'all', 'past'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs tracking-ultra uppercase transition-colors"
              style={{ color: filter === f ? 'var(--ink)' : 'var(--ink-faint)', borderBottom: filter === f ? '1px solid var(--ink)' : 'none', paddingBottom: '2px' }}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={openCreate} className="btn">+ New Session</button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No sessions found.</p>
      ) : (
        <div style={{ border: '1px solid var(--line)' }}>
          <div
            className="hidden md:grid grid-cols-[1fr_140px_100px_1fr_80px] gap-4 px-5 py-3 text-xs tracking-ultra uppercase"
            style={{ color: 'var(--ink-faint)', borderBottom: '1px solid var(--line)', background: 'var(--bg-warm)' }}
          >
            <span>Session</span><span>Date</span><span>Time</span><span>Assigned to</span><span></span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {filtered.map(s => (
              <div key={s.id} className="grid grid-cols-1 md:grid-cols-[1fr_140px_100px_1fr_80px] gap-2 md:gap-4 px-5 py-4 items-center" style={{ background: 'var(--bg)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{s.title}</p>
                  {s.telescope && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{s.telescope}</p>}
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>
                  {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>{s.startTime}–{s.endTime}</span>
                <div className="flex items-center gap-2">
                  {s.user.image && <Image src={s.user.image} alt="" width={18} height={18} className="rounded-full" />}
                  <span className="text-xs truncate" style={{ color: 'var(--ink-secondary)' }}>{s.user.name ?? s.user.email}</span>
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                  className="text-xs"
                  style={{ color: '#cc4444', opacity: deletingId === s.id ? 0.5 : 1 }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md p-8" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
            <p className="label mb-4">New Observation Session</p>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Assign to *</label>
                <select className="input" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} required style={{ background: 'var(--bg)' }}>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Date *</label>
                  <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Telescope</label>
                  <select className="input" value={form.telescope} onChange={e => setForm(f => ({ ...f, telescope: e.target.value }))} style={{ background: 'var(--bg)' }}>
                    <option value="">—</option>
                    {TELESCOPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Start *</label>
                  <input type="time" className="input" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>End *</label>
                  <input type="time" className="input" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Notes</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />
                <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>Show on public calendar</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn flex-1">{saving ? 'Saving…' : 'Save Session'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
