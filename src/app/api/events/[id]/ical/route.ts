import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Returns YYYYMMDD from a UTC Date (event dates are stored as UTC midnight)
function utcDateStr(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

// Returns YYYYMMDDTHHMMSS from YYYYMMDD + "HH:MM"
function icsDateTime(dateStr: string, time: string): string {
  return `${dateStr}T${time.replace(':', '')}00`;
}

// Current moment as YYYYMMDDTHHMMSSZ
function utcNow(): string {
  const iso = new Date().toISOString(); // e.g. "2026-05-14T13:52:00.000Z"
  const date = iso.slice(0, 10).replace(/-/g, '');
  const time = iso.slice(11, 19).replace(/:/g, '');
  return `${date}T${time}Z`;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const event = await db.event.findUnique({ where: { id } });
  if (!event) return new NextResponse('Not found', { status: 404 });

  const dateStr  = utcDateStr(event.date);
  const start    = event.startTime ?? '00:00';
  const end      = event.endTime   ?? start;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NTHU Observatory//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Timezone definition for Asia/Taipei (no DST, always UTC+8)
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Taipei',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${id}@nthuobs.phys.nthu.edu.tw`,
    `DTSTAMP:${utcNow()}`,
    `DTSTART;TZID=Asia/Taipei:${icsDateTime(dateStr, start)}`,
    `DTEND;TZID=Asia/Taipei:${icsDateTime(dateStr, end)}`,
    `SUMMARY:${esc(event.title)}`,
    event.description ? `DESCRIPTION:${esc(event.description)}` : null,
    event.location    ? `LOCATION:${esc(event.location)}`       : null,
    // 1-hour reminder
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:活動提醒：${esc(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return new NextResponse(lines, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="nthuobs-event.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
