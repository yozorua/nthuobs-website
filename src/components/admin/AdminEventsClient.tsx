'use client';

import { useState } from 'react';

interface Event {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  location: string | null;
  isPublic: boolean;
}

const emptyForm = { title: '', description: '', date: '', location: '', isPublic: true };

export default function AdminEventsClient({ initialEvents }: { initialEvents: Event[] }) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (ev: Event) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      date: new Date(ev.date).toISOString().split('T')[0],
      location: ev.location ?? '',
      isPublic: ev.isPublic,
    });
    setShowModal(true);
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
          body: JSON.stringify(form),
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
    if (!confirm('Delete this event?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
      if (res.ok) setEvents(prev => prev.filter(ev => ev.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="label">Public Events</p>
        <button onClick={openCreate} className="btn">+ New Event</button>
      </div>

      {events.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No events yet.</p>
      ) : (
        <div style={{ border: '1px solid var(--line)' }}>
          <div
            className="hidden md:grid grid-cols-[1fr_140px_120px_80px_80px] gap-4 px-5 py-3 text-xs tracking-ultra uppercase"
            style={{ color: 'var(--ink-faint)', borderBottom: '1px solid var(--line)', background: 'var(--bg-warm)' }}
          >
            <span>Title</span><span>Date</span><span>Location</span><span>Visibility</span><span></span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {events.map(ev => (
              <div key={ev.id} className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_80px_80px] gap-2 md:gap-4 px-5 py-4 items-center" style={{ background: 'var(--bg)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{ev.title}</p>
                  {ev.description && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ink-faint)' }}>{ev.description}</p>}
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>
                  {new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-xs truncate" style={{ color: 'var(--ink-faint)' }}>{ev.location ?? '—'}</span>
                <span className="text-xs tracking-ultra uppercase" style={{ color: ev.isPublic ? 'var(--ink-secondary)' : 'var(--ink-faint)' }}>
                  {ev.isPublic ? 'Public' : 'Private'}
                </span>
                <div className="flex gap-3">
                  <button onClick={() => openEdit(ev)} className="text-xs hover-link" style={{ color: 'var(--ink-faint)' }}>Edit</button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="text-xs"
                    style={{ color: '#cc4444', opacity: deletingId === ev.id ? 0.5 : 1 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md p-8" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
            <p className="label mb-4">{editing ? 'Edit Event' : 'New Event'}</p>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Date *</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Location</label>
                <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs tracking-ultra uppercase mb-1.5 block" style={{ color: 'var(--ink-faint)' }}>Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />
                <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>Show on public calendar</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn flex-1">{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
