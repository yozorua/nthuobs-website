import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const db = new PrismaClient();

const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SITE_URL  = process.env.AUTH_URL ?? 'https://nthuobs.phys.nthu.edu.tw';

// Window: send the reminder when event starts between 11 h and 13 h from now.
// Running every 5 min means we never miss the window even with brief downtime.
const WINDOW_MIN_H = 11;
const WINDOW_MAX_H = 13;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

if (!SMTP_USER || !SMTP_PASS) {
  console.error('[REMINDER] SMTP_USER or SMTP_PASS not set in .env — emails will not be sent.');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// Combine event.date (a Date at midnight) with startTime string "HH:MM"
// using local server time — the server should be set to Asia/Taipei.
function buildStartDatetime(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function buildEmailHtml(opts: {
  name: string;
  eventId: string;
  title: string;
  dateStr: string;       // display string e.g. "2026/05/13"
  dateIcal: string;      // YYYYMMDD for calendar URLs
  startTime: string;
  endTime: string | null;
  location: string | null;
  description: string | null;
  estimatedVisitors: number | null;
  participants: string[];
}): string {
  const timeRange = opts.endTime ? `${opts.startTime} – ${opts.endTime}` : opts.startTime;
  const locationRow = opts.location
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#555;">地點　${opts.location}</td></tr>`
    : '';
  const estimatedRow = opts.estimatedVisitors
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#555;">人數　預計 ${opts.estimatedVisitors} 人</td></tr>`
    : '';
  const descBlock = opts.description
    ? `<tr><td style="padding:0 32px 28px;font-size:13px;line-height:1.7;color:#555;">${opts.description.replace(/\n/g, '<br>')}</td></tr>`
    : '';
  const participantsList = opts.participants.length > 0
    ? `<tr><td style="padding:0 32px 28px;">
        <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;">
          報名成員 Participants
        </p>
        ${opts.participants.map(n =>
          `<p style="margin:0 0 4px;font-size:13px;color:#555;">· ${n}</p>`
        ).join('')}
      </td></tr>`
    : '';

  // Calendar links
  const icsUrl = `${SITE_URL}/api/events/${opts.eventId}/ical`;
  const gcalStart = `${opts.dateIcal}T${opts.startTime.replace(':', '')}00`;
  const gcalEnd   = `${opts.dateIcal}T${(opts.endTime ?? opts.startTime).replace(':', '')}00`;
  const gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(opts.title)}`
    + `&dates=${gcalStart}/${gcalEnd}`
    + `&ctz=Asia%2FTaipei`
    + (opts.location    ? `&location=${encodeURIComponent(opts.location)}`       : '')
    + (opts.description ? `&details=${encodeURIComponent(opts.description)}`     : '');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;">
  <tr>
    <td style="padding:28px 32px 20px;border-bottom:1px solid #e8e8e8;">
      <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#aaa;">
        國立清華大學天文台
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 32px 0;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">Hi ${opts.name},</p>
      <h1 style="margin:0 0 6px;font-size:15px;font-weight:500;color:#222;">
        您報名的活動將在 12 小時後開始
      </h1>
      <p style="margin:0 0 28px;font-size:12px;color:#aaa;">The event you joined starts in 12 hours</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 28px;">
      <table cellpadding="0" cellspacing="0" style="border-left:3px solid #222;padding-left:16px;">
        <tr>
          <td style="font-size:20px;font-weight:300;color:#111;padding-bottom:12px;letter-spacing:0.03em;">
            ${opts.title}
          </td>
        </tr>
        <tr><td style="padding:3px 0;font-size:13px;color:#555;">日期　${opts.dateStr}</td></tr>
        <tr><td style="padding:3px 0;font-size:13px;color:#555;">時間　${timeRange}</td></tr>
        ${locationRow}
        ${estimatedRow}
      </table>
    </td>
  </tr>
  ${descBlock}
  ${participantsList}
  <tr>
    <td style="padding:0 32px 28px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:10px;">
            <a href="${SITE_URL}/tw/calendar"
               style="display:inline-block;padding:10px 22px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;background:#111;color:#fff;text-decoration:none;">
              查看活動詳情
            </a>
          </td>
          <td>
            <a href="${gcalUrl}"
               style="display:inline-block;padding:10px 22px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;border:1px solid #ccc;color:#333;text-decoration:none;">
              加入 Google 行事曆
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;border-top:1px solid #e8e8e8;background:#fafafa;">
      <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6;">
        國立清華大學天文台 &nbsp;·&nbsp; NTHU Observatory<br>
        此為系統自動發送之提醒郵件，請勿直接回覆。<br>
        This is an automated reminder. Please do not reply to this email.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendReminders(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_MIN_H * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + WINDOW_MAX_H * 60 * 60 * 1000);

  // Fetch only future events that haven't been reminded yet
  const events = await db.event.findMany({
    where: {
      reminderSentAt: null,
      date: { gte: new Date(now.getTime() + WINDOW_MIN_H * 60 * 60 * 1000 - 24 * 60 * 60 * 1000) },
    },
    include: {
      participations: {
        include: {
          user: {
            select: {
              name: true,
              firstNameEn: true,
              lastNameEn: true,
              firstNameZh: true,
              lastNameZh: true,
              email: true,
              contactEmail: true,
            },
          },
        },
      },
    },
  });

  for (const event of events) {
    if (!event.startTime) continue; // can't determine exact time without startTime

    const start = buildStartDatetime(event.date, event.startTime);
    if (start < windowStart || start > windowEnd) continue;

    console.log(`[REMINDER] Sending reminders for: "${event.title}" (starts ${start.toISOString()})`);

    if (event.participations.length === 0) {
      await db.event.update({ where: { id: event.id }, data: { reminderSentAt: now } });
      console.log(`[REMINDER]   No participants — marked without sending.`);
      continue;
    }

    // Build participant name list once (shared across all individual emails)
    const participantNames = event.participations.map(p => {
      const u = p.user;
      if (u.lastNameZh && u.firstNameZh) return `${u.lastNameZh}${u.firstNameZh}`;
      if (u.firstNameEn && u.lastNameEn) return `${u.firstNameEn} ${u.lastNameEn}`;
      return u.name ?? u.email;
    });

    let sent = 0;
    for (const participation of event.participations) {
      const user = participation.user;
      const to = user.contactEmail ?? user.email;
      // Greeting uses Chinese first name only; fall back to English first name or full name
      const displayName = user.firstNameZh ?? user.firstNameEn ?? user.name ?? to;

      const d = event.date;
      const dateIcal = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;

      const html = buildEmailHtml({
        name: displayName,
        eventId: event.id,
        title: event.title,
        dateStr: formatDate(event.date),
        dateIcal,
        startTime: event.startTime,
        endTime: event.endTime ?? null,
        location: event.location ?? null,
        description: event.description ?? null,
        estimatedVisitors: event.estimatedVisitors ?? null,
        participants: participantNames,
      });

      try {
        await transporter.sendMail({
          from: `NTHU Observatory <${SMTP_USER}>`,
          to,
          subject: `清大天文台 活動提醒：${event.title}`,
          html,
        });
        sent++;
        console.log(`[REMINDER]   ✓ Sent to ${to}`);
      } catch (err) {
        console.error(`[REMINDER]   ✗ Failed to send to ${to}:`, err);
      }
    }

    await db.event.update({ where: { id: event.id }, data: { reminderSentAt: now } });
    console.log(`[REMINDER]   Done — ${sent}/${event.participations.length} emails sent.`);
  }
}

async function main() {
  console.log('[REMINDER] Starting event reminder daemon...');
  console.log(`[REMINDER] Checking every ${CHECK_INTERVAL_MS / 60000} min, sending ${WINDOW_MIN_H}–${WINDOW_MAX_H}h before start.`);

  await sendReminders();
  setInterval(() => {
    sendReminders().catch(err => console.error('[REMINDER] Error during check:', err));
  }, CHECK_INTERVAL_MS);
}

main().catch(err => {
  console.error('[REMINDER] FATAL:', err);
  process.exit(1);
});
