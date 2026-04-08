'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_TW = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_TW = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

type Entry = { id: string; title: string; date: string; description?: string; location?: string; type: 'event' };

export default function CalendarClient({ entries }: { entries: Entry[] }) {
  const t = useTranslations('calendar');
  const { locale } = useParams<{ locale: string }>();
  const isTw = locale === 'tw';
  const DAYS = isTw ? DAYS_TW : DAYS_EN;
  const MONTHS = isTw ? MONTHS_TW : MONTHS_EN;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<number | null>(null);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const entriesForDay = (d: number) =>
    entries.filter(e => {
      const date = new Date(e.date);
      return date.getFullYear() === year && date.getMonth() === month && date.getDate() === d;
    });

  const hasEntries = (d: number) => entriesForDay(d).length > 0;

  const selectedEntries = selected ? entriesForDay(selected) : [];

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 py-16">
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('label')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main calendar */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <button onClick={prev} className="text-sm px-3 py-1 transition-colors hover-faint">←</button>
            <div className="flex items-center gap-3">
              <span className="text-lg font-light tracking-wider" style={{ color: 'var(--ink)' }}>{MONTHS[month]}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setYear(y => y - 1)}
                  className="text-xs px-1.5 py-0.5 transition-colors hover-faint"
                  style={{ color: 'var(--ink-faint)' }}
                >−</button>
                <span className="text-lg font-light tracking-wider" style={{ color: 'var(--ink)' }}>{year}</span>
                <button
                  onClick={() => setYear(y => y + 1)}
                  className="text-xs px-1.5 py-0.5 transition-colors hover-faint"
                  style={{ color: 'var(--ink-faint)' }}
                >+</button>
              </div>
            </div>
            <button onClick={next} className="text-sm px-3 py-1 transition-colors hover-faint">→</button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs py-2 tracking-wider" style={{ color: 'var(--ink-faint)' }}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--line)' }}>
            {cells.map((day, i) => (
              <div
                key={i}
                onClick={() => day && setSelected(day)}
                className={`relative flex flex-col items-center justify-center aspect-square text-sm transition-colors ${day ? 'cursor-pointer' : ''}`}
                style={{
                  background:
                    day === null ? 'var(--bg-muted)'
                    : isToday(day) ? 'var(--ink)'
                    : selected === day ? 'var(--bg-warm)'
                    : 'var(--bg)',
                  color: isToday(day) ? 'var(--bg)' : 'var(--ink)',
                }}
              >
                {day}
                {day && hasEntries(day) && (
                  <span
                    className="absolute bottom-1.5 w-1 h-1 rounded-full"
                    style={{ background: isToday(day) ? 'var(--bg)' : 'var(--ink-secondary)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Opening hours */}
          <div className="p-5 space-y-4" style={{ border: '1px solid var(--line)' }}>
            <p className="label">{t('openingLabel')}</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink)' }}>{t('afternoon')}</p>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>13:30 – 17:30</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink)' }}>{t('evening')}</p>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>19:00 – 22:00</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed pt-1" style={{ color: 'var(--ink-faint)' }}>{t('hoursNote')}</p>
          </div>

          {/* Selected date events */}
          {selected && (
            <div className="p-5" style={{ border: '1px solid var(--line)' }}>
              <p className="label mb-3">{MONTHS[month]} {selected}, {year}</p>
              {selectedEntries.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {isTw ? '目前沒有活動' : 'No events scheduled'}
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedEntries.map(entry => (
                    <div key={entry.id} className="pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
                      <p className="text-sm font-light" style={{ color: 'var(--ink)' }}>{entry.title}</p>
                      {entry.location && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{entry.location}</p>
                      )}
                      {entry.description && (
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{entry.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
