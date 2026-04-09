'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';

/* ─── constants ──────────────────────────────────────────── */
const NIGHT_START = 18;           // 18:00 local
const NIGHT_END   = 8;            // 08:00 local next day
const TOTAL_HOURS = 14;
const HOUR_W      = 64;           // px per hour
const TIMELINE_W  = TOTAL_HOURS * HOUR_W;  // 896
const LEFT_W      = 156;          // px for left info panel
const ROW_H       = 22;           // px for astro/weather rows
const TEL_ROW_H   = 26;           // px for telescope rows

const TELESCOPES = [
  '25 cm Refractor',
  '16-inch Cassegrain',
  'Celestron 8 (No.1)',
  'Celestron 8 (No.2)',
];

// Palette for reservation blocks (cycle through users)
const USER_COLORS = [
  { bg: 'rgba(63,145,255,0.25)', border: '#3f91ff', text: '#3f91ff' },
  { bg: 'rgba(225,173,36,0.25)', border: '#e1ad24', text: '#e1ad24' },
  { bg: 'rgba(255,126,167,0.25)', border: '#ff7ea7', text: '#ff7ea7' },
  { bg: 'rgba(100,220,180,0.25)', border: '#64dcb4', text: '#64dcb4' },
];

/* ─── types ──────────────────────────────────────────────── */
type WeatherSlot = {
  consoleTime: string;
  cloudCoverHigh: number | null;
  cloudCoverMid:  number | null;
  cloudCoverLow:  number | null;
  windSpeedMs:    number | null;
  rainRateMmHr:   number | null;
};

type ScheduleEntry = {
  id:        string;
  title:     string;
  startTime: string;
  endTime:   string;
  telescope: string | null;
  userId:    string;
  userName:  string;
};

type NightData = {
  date:      string;
  nextDate:  string;
  sunrise:   string | null;
  sunset:    string | null;
  moonrise:  string | null;
  moonset:   string | null;
  moonPhase: string | null;
  weather:   WeatherSlot[];
  schedules: ScheduleEntry[];
};

/* ─── time helpers ───────────────────────────────────────── */
// Convert HH:MM (local) → pixel x within the night timeline.
// Returns null if time is outside [18:00, 08:00].
function timeToX(t: string | null | undefined): number | null {
  if (!t) return null;
  const colonIdx = t.indexOf(':');
  if (colonIdx < 0) return null;
  const h = parseInt(t.slice(0, colonIdx), 10);
  const m = parseInt(t.slice(colonIdx + 1, colonIdx + 3), 10);
  if (isNaN(h) || isNaN(m)) return null;
  let mins: number;
  if (h >= NIGHT_START)             mins = (h - NIGHT_START) * 60 + m;
  else if (h < NIGHT_END)           mins = (24 - NIGHT_START + h) * 60 + m;
  else                              return null;
  return Math.round(mins * HOUR_W / 60);
}

function clampX(x: number) { return Math.max(0, Math.min(TIMELINE_W, x)); }

// Click x → snapped HH:MM string
function xToTime(x: number): string {
  const slotMins  = Math.floor(x / (HOUR_W / 4)) * 15;  // 15-min slots
  const totalMins = Math.max(0, Math.min(TOTAL_HOURS * 60 - 15, slotMins));
  let h = NIGHT_START + Math.floor(totalMins / 60);
  if (h >= 24) h -= 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// consoleTime (UTC ISO) → local TW HH:MM string
function utcToTWTime(iso: string): string {
  const t   = new Date(iso).getTime() + 8 * 3600 * 1000;
  const d   = new Date(t);
  const h   = d.getUTCHours();
  const min = d.getUTCMinutes();
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/* ─── sub-components ─────────────────────────────────────── */

function TimeHeader() {
  const hours: number[] = [];
  for (let h = 0; h < TOTAL_HOURS + 1; h++) {
    const label = (NIGHT_START + h) % 24;
    hours.push(label);
  }
  return (
    <div
      className="relative select-none"
      style={{ width: TIMELINE_W, height: 20, position: 'relative' }}
    >
      {hours.map((label, i) => (
        <span
          key={i}
          className="absolute text-xs"
          style={{
            left:      i * HOUR_W - 8,
            top:       2,
            color:     'var(--ink-faint)',
            fontSize:  10,
            minWidth:  16,
            textAlign: 'center',
          }}
        >
          {String(label).padStart(2, '0')}
        </span>
      ))}
      {/* tick marks */}
      {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => (
        <div
          key={i}
          style={{
            position:  'absolute',
            left:      i * HOUR_W,
            top:       0,
            width:     1,
            height:    '100%',
            background: 'var(--line)',
          }}
        />
      ))}
    </div>
  );
}

function SunBar({ sunrise, sunset }: { sunrise: string | null; sunset: string | null }) {
  const riseX   = timeToX(sunrise);
  const setX    = timeToX(sunset);

  // We draw daylight zones
  const segments: { x: number; w: number; color: string }[] = [];

  // Before sunset (evening twilight / daylight at start of night)
  if (setX !== null && setX > 0) {
    segments.push({ x: 0, w: clampX(setX), color: 'rgba(225,173,36,0.55)' });
  }
  // After sunrise (dawn / daylight at end of night)
  if (riseX !== null && riseX < TIMELINE_W) {
    segments.push({ x: clampX(riseX), w: TIMELINE_W - clampX(riseX), color: 'rgba(225,173,36,0.55)' });
  }

  return (
    <div style={{ position: 'relative', width: TIMELINE_W, height: ROW_H, overflow: 'hidden' }}>
      {/* full-width grid lines */}
      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: (i + 1) * HOUR_W, top: 0, width: 1, height: '100%', background: 'var(--line)' }} />
      ))}
      {segments.map((s, i) => (
        <div
          key={i}
          style={{
            position:     'absolute',
            left:         s.x,
            width:        s.w,
            top:          3,
            height:       ROW_H - 6,
            background:   s.color,
            borderRadius: 2,
          }}
        />
      ))}
      {/* sunset marker */}
      {setX !== null && (
        <div style={{ position: 'absolute', left: clampX(setX) - 1, top: 0, width: 2, height: '100%', background: '#e1ad24', opacity: 0.8 }} />
      )}
      {/* sunrise marker */}
      {riseX !== null && (
        <div style={{ position: 'absolute', left: clampX(riseX) - 1, top: 0, width: 2, height: '100%', background: '#e1ad24', opacity: 0.8 }} />
      )}
    </div>
  );
}

function MoonBar({ moonrise, moonset }: { moonrise: string | null; moonset: string | null }) {
  const riseX = timeToX(moonrise);
  const setX  = timeToX(moonset);

  let x = 0, w = 0;
  if (riseX !== null && setX !== null) {
    x = clampX(riseX);
    w = clampX(setX) - x;
  } else if (riseX !== null) {
    x = clampX(riseX);
    w = TIMELINE_W - x;
  } else if (setX !== null) {
    x = 0;
    w = clampX(setX);
  } else if (moonrise === null && moonset === null) {
    w = 0; // no data
  }

  return (
    <div style={{ position: 'relative', width: TIMELINE_W, height: ROW_H, overflow: 'hidden' }}>
      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: (i + 1) * HOUR_W, top: 0, width: 1, height: '100%', background: 'var(--line)' }} />
      ))}
      {w > 0 && (
        <div style={{
          position:     'absolute',
          left:         x,
          width:        w,
          top:          3,
          height:       ROW_H - 6,
          background:   'rgba(63,145,255,0.22)',
          borderRadius: 2,
          border:       '1px solid rgba(63,145,255,0.3)',
        }} />
      )}
    </div>
  );
}

function WeatherBar({ slots, type }: { slots: WeatherSlot[]; type: 'cloud' | 'wind' }) {
  if (slots.length === 0) {
    return (
      <div style={{ position: 'relative', width: TIMELINE_W, height: ROW_H }}>
        {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: (i + 1) * HOUR_W, top: 0, width: 1, height: '100%', background: 'var(--line)' }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>no data</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: TIMELINE_W, height: ROW_H, overflow: 'hidden' }}>
      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: (i + 1) * HOUR_W, top: 0, width: 1, height: '100%', background: 'var(--line)' }} />
      ))}
      {slots.map((slot, i) => {
        const x = timeToX(utcToTWTime(slot.consoleTime));
        if (x === null) return null;
        const nextSlot = slots[i + 1];
        const nextX = nextSlot ? (timeToX(utcToTWTime(nextSlot.consoleTime)) ?? TIMELINE_W) : TIMELINE_W;
        const w = Math.max(1, nextX - x);

        let alpha = 0;
        if (type === 'cloud') {
          const cover = Math.max(
            slot.cloudCoverHigh ?? 0,
            slot.cloudCoverMid  ?? 0,
            slot.cloudCoverLow  ?? 0,
          ) / 100;
          alpha = cover * 0.6;
        } else {
          const wind  = slot.windSpeedMs ?? 0;
          alpha = Math.min(wind / 15, 1) * 0.6;
        }

        const color = type === 'cloud'
          ? `rgba(160,160,180,${alpha})`
          : `rgba(255,126,167,${alpha})`;

        return (
          <div
            key={i}
            style={{
              position:   'absolute',
              left:       x,
              width:      w,
              top:        3,
              height:     ROW_H - 6,
              background: color,
            }}
          />
        );
      })}
    </div>
  );
}

function TelescopeRow({
  telescope,
  schedules,
  date,
  currentUserId,
  userColorMap,
  onSlotClick,
  onDelete,
}: {
  telescope: string;
  schedules: ScheduleEntry[];
  date: string;
  currentUserId: string;
  userColorMap: Map<string, number>;
  onSlotClick: (telescope: string, startTime: string) => void;
  onDelete: (id: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const telSchedules = schedules.filter(s => s.telescope === telescope);

  const handleClick = (e: React.MouseEvent) => {
    if (!rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSlotClick(telescope, xToTime(x));
  };

  return (
    <div
      ref={rowRef}
      onClick={handleClick}
      title="Click to book this slot"
      style={{
        position:   'relative',
        width:      TIMELINE_W,
        height:     TEL_ROW_H,
        cursor:     'crosshair',
        overflow:   'hidden',
      }}
    >
      {/* hour grid */}
      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: (i + 1) * HOUR_W, top: 0, width: 1, height: '100%', background: 'var(--line)' }} />
      ))}

      {/* 15-min tick guides */}
      {Array.from({ length: TOTAL_HOURS * 4 }).map((_, i) => {
        if (i % 4 === 0) return null;
        return (
          <div key={i} style={{
            position:   'absolute',
            left:       i * (HOUR_W / 4),
            top:        '30%',
            width:      1,
            height:     '40%',
            background: 'var(--line)',
            opacity:    0.5,
          }} />
        );
      })}

      {/* reservation blocks */}
      {telSchedules.map(s => {
        const x1 = timeToX(s.startTime);
        const x2 = timeToX(s.endTime);
        if (x1 === null) return null;
        const endX = x2 ?? TIMELINE_W;
        const w    = Math.max(4, clampX(endX) - clampX(x1));
        const colorIdx = userColorMap.get(s.userId) ?? 0;
        const pal = USER_COLORS[colorIdx % USER_COLORS.length];
        const isOwn = s.userId === currentUserId;

        return (
          <div
            key={s.id}
            onClick={e => { e.stopPropagation(); }}
            title={`${s.title} · ${s.userName} · ${s.startTime}–${s.endTime}`}
            style={{
              position:     'absolute',
              left:         clampX(x1),
              width:        w,
              top:          2,
              height:       TEL_ROW_H - 4,
              background:   pal.bg,
              border:       `1px solid ${pal.border}`,
              borderRadius: 2,
              display:      'flex',
              alignItems:   'center',
              overflow:     'hidden',
              gap:          4,
              paddingLeft:  4,
              paddingRight: isOwn ? 18 : 4,
            }}
          >
            <span style={{ fontSize: 9, color: pal.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.03em' }}>
              {s.userName}
            </span>
            {isOwn && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                title="Delete"
                style={{
                  position:   'absolute',
                  right:      3,
                  top:        '50%',
                  transform:  'translateY(-50%)',
                  fontSize:   9,
                  lineHeight: 1,
                  color:      pal.text,
                  opacity:    0.7,
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  padding:    0,
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Night Section ──────────────────────────────────────── */
function NightSection({
  night,
  currentUserId,
  userColorMap,
  onSlotClick,
  onDelete,
}: {
  night: NightData;
  currentUserId: string;
  userColorMap: Map<string, number>;
  onSlotClick: (date: string, telescope: string, startTime: string) => void;
  onDelete: (id: string) => void;
}) {
  const d1 = new Date(night.date + 'T00:00:00Z');
  const d2 = new Date(night.nextDate + 'T00:00:00Z');

  // Format dates in TW offset (UTC+8)
  const fmtDate = (d: Date) => {
    const tw = new Date(d.getTime() + 8 * 3600 * 1000);
    return tw.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  const fmtDay = (d: Date) => {
    const tw = new Date(d.getTime() + 8 * 3600 * 1000);
    return tw.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  };

  const rowLabel = (label: string) => (
    <div style={{ width: LEFT_W, flexShrink: 0, display: 'flex', alignItems: 'center', height: ROW_H, paddingRight: 8 }}>
      <span style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );

  const telRowLabel = (tel: string) => (
    <div style={{ width: LEFT_W, flexShrink: 0, display: 'flex', alignItems: 'center', height: TEL_ROW_H, paddingRight: 8 }}>
      <span style={{ fontSize: 9, color: 'var(--ink-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tel}</span>
    </div>
  );

  return (
    <div
      style={{
        border:         '1px solid var(--line)',
        marginBottom:   12,
        overflow:       'hidden',
      }}
    >
      {/* Night title bar */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          padding:      '6px 12px',
          background:   'var(--bg-warm)',
          borderBottom: '1px solid var(--line)',
          gap:          16,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', letterSpacing: '0.05em' }}>
          {fmtDate(d1)} – {fmtDate(d2)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
          {fmtDay(d1)} – {fmtDay(d2)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          {night.sunrise && (
            <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>
              <span style={{ color: '#e1ad24', marginRight: 3 }}>↑</span>{night.sunrise}
            </span>
          )}
          {night.sunset && (
            <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>
              <span style={{ color: '#e1ad24', marginRight: 3 }}>↓</span>{night.sunset}
            </span>
          )}
          {night.moonrise && (
            <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>
              <span style={{ color: '#3f91ff', marginRight: 3 }}>☽↑</span>{night.moonrise}
            </span>
          )}
          {night.moonset && (
            <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>
              <span style={{ color: '#3f91ff', marginRight: 3 }}>☽↓</span>{night.moonset}
            </span>
          )}
          {night.moonPhase && (
            <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>{night.moonPhase}</span>
          )}
        </div>
      </div>

      {/* Scrollable timetable body */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: LEFT_W + TIMELINE_W + 1, paddingBottom: 6 }}>

          {/* Time header row */}
          <div style={{ display: 'flex', paddingTop: 6 }}>
            <div style={{ width: LEFT_W, flexShrink: 0 }} />
            <TimeHeader />
          </div>

          {/* Sun row */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {rowLabel('Sunlight')}
            <SunBar sunrise={night.sunrise} sunset={night.sunset} />
          </div>

          {/* Moon row */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {rowLabel('Moon')}
            <MoonBar moonrise={night.moonrise} moonset={night.moonset} />
          </div>

          {/* Cloud row */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {rowLabel('Cloud Cover')}
            <WeatherBar slots={night.weather} type="cloud" />
          </div>

          {/* Wind row */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {rowLabel('Wind Speed')}
            <WeatherBar slots={night.weather} type="wind" />
          </div>

          {/* Separator */}
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />

          {/* Telescope rows */}
          {TELESCOPES.map(tel => (
            <div key={tel} style={{ display: 'flex', alignItems: 'center' }}>
              {telRowLabel(tel)}
              <TelescopeRow
                telescope={tel}
                schedules={night.schedules}
                date={night.date}
                currentUserId={currentUserId}
                userColorMap={userColorMap}
                onSlotClick={(telescope, startTime) => onSlotClick(night.date, telescope, startTime)}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal ──────────────────────────────────────────────── */
type FormState = {
  title: string;
  date: string;
  telescope: string;
  startTime: string;
  endTime: string;
  description: string;
  isPublic: boolean;
};

function ReservationModal({
  defaults,
  onClose,
  onSaved,
}: {
  defaults: Partial<FormState>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    title:       defaults.title       ?? '',
    date:        defaults.date        ?? '',
    telescope:   defaults.telescope   ?? '',
    startTime:   defaults.startTime   ?? '',
    endTime:     defaults.endTime     ?? '',
    description: defaults.description ?? '',
    isPublic:    defaults.isPublic    ?? false,
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/api/schedule', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.ok) { onSaved(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="relative w-full max-w-lg p-8 z-10"
        style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            New Observation Session
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none transition-colors"
            style={{ color: 'var(--ink-faint)' }}
          >×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>Title *</label>
            <input className="input" value={form.title} onChange={e => set('title', e.target.value)} required placeholder="e.g. Jupiter Observation" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>Date *</label>
              <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>Telescope</label>
              <select className="input" value={form.telescope} onChange={e => set('telescope', e.target.value)}>
                <option value="">Select…</option>
                {TELESCOPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>Start *</label>
              <input type="time" className="input" value={form.startTime} onChange={e => set('startTime', e.target.value)} required />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>End *</label>
              <input type="time" className="input" value={form.endTime} onChange={e => set('endTime', e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-faint)' }}>Notes</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional notes…" />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isPublic} onChange={e => set('isPublic', e.target.checked)} className="w-3.5 h-3.5" />
            <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>Show on public calendar</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn flex-1">
              {submitting ? 'Saving…' : 'Save Session'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function TimetableSchedule() {
  const { data: session } = useSession();
  const params = useParams<{ locale: string }>();

  const [nights, setNights]         = useState<NightData[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [modalDefaults, setModalDefaults] = useState<Partial<FormState>>({});

  // Build a stable color map: userId → color index
  const userColorMap = useRef<Map<string, number>>(new Map());
  const colorCounter = useRef(0);

  const fetchNights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedule/timetable?days=4');
      if (res.ok) {
        const data: NightData[] = await res.json();
        // Update color map
        data.forEach(n => {
          n.schedules.forEach(s => {
            if (!userColorMap.current.has(s.userId)) {
              userColorMap.current.set(s.userId, colorCounter.current++);
            }
          });
        });
        setNights(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNights(); }, [fetchNights]);

  const handleSlotClick = (date: string, telescope: string, startTime: string) => {
    // Compute a default end time 1 hour later
    const [hh, mm] = startTime.split(':').map(Number);
    let endH = hh + 1;
    if (endH >= 24) endH -= 24;
    const endTime = `${String(endH).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    setModalDefaults({ date, telescope, startTime, endTime });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reservation?')) return;
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    fetchNights();
  };

  const currentUserId = (session?.user as { id?: string })?.id ?? '';

  // Current TW time display
  const [twTime, setTwTime] = useState('');
  useEffect(() => {
    const update = () => {
      const tw = new Date(Date.now() + 8 * 3600 * 1000);
      setTwTime(tw.toISOString().replace('T', ' ').slice(0, 16) + ' UTC+8');
    };
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="page-enter max-w-6xl mx-auto px-6 pt-8 pb-16">
      {/* Header */}
      <div
        className="flex items-start justify-between mb-8 pb-6"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div>
          <p className="label mb-3">Member Portal</p>
          <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            Telescope Reservation
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3 mt-1">
          {twTime && (
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>{twTime}</span>
          )}
          <button
            onClick={() => { setModalDefaults({}); setShowModal(true); }}
            className="btn"
          >
            + New Session
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 mb-6">
        {[
          { color: 'rgba(225,173,36,0.55)', label: 'Sunlight' },
          { color: 'rgba(63,145,255,0.22)', label: 'Moon visible' },
          { color: 'rgba(160,160,180,0.4)', label: 'Cloud cover' },
          { color: 'rgba(255,126,167,0.4)', label: 'Wind' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 20, height: 8, background: color, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>{label}</span>
          </span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.04em', marginLeft: 'auto' }}>
          Click any telescope row to book a slot
        </span>
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>Loading schedule…</p>
      ) : (
        nights.map(night => (
          <NightSection
            key={night.date}
            night={night}
            currentUserId={currentUserId}
            userColorMap={userColorMap.current}
            onSlotClick={handleSlotClick}
            onDelete={handleDelete}
          />
        ))
      )}

      {showModal && (
        <ReservationModal
          defaults={modalDefaults}
          onClose={() => setShowModal(false)}
          onSaved={fetchNights}
        />
      )}
    </div>
  );
}
