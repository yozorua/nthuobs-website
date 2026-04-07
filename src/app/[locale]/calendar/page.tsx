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

export default function CalendarPage() {
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

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('label')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main calendar */}
        <div className="lg:col-span-2">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={prev}
              className="text-sm px-3 py-1 transition-colors hover-faint"
            >
              ←
            </button>
            <h2 className="text-lg font-light tracking-wider" style={{ color: 'var(--ink)' }}>
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={next}
              className="text-sm px-3 py-1 transition-colors hover-faint"
            >
              →
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div
                key={d}
                className="text-center text-xs py-2 tracking-wider"
                style={{ color: 'var(--ink-faint)' }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div
            className="grid grid-cols-7 gap-px"
            style={{ background: 'var(--line)' }}
          >
            {cells.map((day, i) => (
              <div
                key={i}
                onClick={() => day && setSelected(day)}
                className={`relative flex items-center justify-center aspect-square text-sm transition-colors ${
                  day ? 'cursor-pointer' : ''
                }`}
                style={{
                  background:
                    day === null
                      ? 'var(--bg-muted)'
                      : isToday(day)
                      ? 'var(--ink)'
                      : selected === day
                      ? 'var(--bg-warm)'
                      : 'var(--bg)',
                  color:
                    isToday(day)
                      ? 'var(--bg)'
                      : 'var(--ink)',
                }}
              >
                {day}
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
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink)' }}>
                  {t('afternoon')}
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>13:30 – 17:30</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink)' }}>
                  {t('evening')}
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>19:00 – 22:00</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed pt-1" style={{ color: 'var(--ink-faint)' }}>
              {t('hoursNote')}
            </p>
          </div>

          {/* Subscribe */}
          <div className="p-5" style={{ border: '1px solid var(--line)' }}>
            <p className="label mb-3">{t('subscribeLabel')}</p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--ink-secondary)' }}>
              {t('subscribeDesc')}
            </p>
            <a
              href="https://calendar.google.com/calendar/r?cid=nthuobs@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-xs"
            >
              {t('addCalendar')}
            </a>
          </div>

          {/* Selected date */}
          {selected && (
            <div className="p-5" style={{ border: '1px solid var(--line)' }}>
              <p className="label mb-2">{isTw ? '選取日期' : 'Selected'}</p>
              <p className="text-sm font-light" style={{ color: 'var(--ink)' }}>
                {MONTHS[month]} {selected}, {year}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>
                {isTw ? '目前沒有活動' : 'No events scheduled'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
