import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import nodemailer from 'nodemailer';

const canManageEvents = (role?: string) => ['ADMIN', 'MANAGER'].includes(role ?? '');

const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SITE_URL  = process.env.AUTH_URL ?? 'https://nthuobs.phys.nthu.edu.tw';

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function formatDate(d: Date): string {
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}

function buildAnnouncementEmailHtml(opts: {
  name: string;
  eventId: string;
  title: string;
  dateStr: string;
  dateIcal: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  estimatedVisitors: number | null;
  maxParticipants: number | null;
}): string {
  const timeRange = opts.startTime
    ? (opts.endTime ? `${opts.startTime} – ${opts.endTime}` : opts.startTime)
    : null;
  const timeRow = timeRange
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#555;">時間　${timeRange}</td></tr>`
    : '';
  const locationRow = opts.location
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#555;">地點　${opts.location}</td></tr>`
    : '';
  const estimatedRow = opts.estimatedVisitors
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#555;">人數　預計 ${opts.estimatedVisitors} 人</td></tr>`
    : '';
  const maxParticipantsRow = opts.maxParticipants
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#555;">導覽員需求人數　${opts.maxParticipants} 人</td></tr>`
    : '';
  const descBlock = opts.description
    ? `<tr><td style="padding:0 32px 28px;font-size:13px;line-height:1.7;color:#555;">${opts.description.replace(/\n/g, '<br>')}</td></tr>`
    : '';

  const gcalStart = opts.startTime
    ? `${opts.dateIcal}T${opts.startTime.replace(':', '')}00`
    : opts.dateIcal;
  const gcalEnd = opts.startTime
    ? `${opts.dateIcal}T${(opts.endTime ?? opts.startTime).replace(':', '')}00`
    : opts.dateIcal;
  const gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(opts.title)}`
    + `&dates=${gcalStart}/${gcalEnd}`
    + `&ctz=Asia%2FTaipei`
    + (opts.location    ? `&location=${encodeURIComponent(opts.location)}`    : '')
    + (opts.description ? `&details=${encodeURIComponent(opts.description)}`  : '');

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
      <h1 style="margin:0 0 28px;font-size:15px;font-weight:500;color:#222;">
        天文台活動公告
      </h1>
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
        ${timeRow}
        ${locationRow}
        ${estimatedRow}
        ${maxParticipantsRow}
      </table>
    </td>
  </tr>
  ${descBlock}
  <tr>
    <td style="padding:0 32px 20px;font-size:13px;color:#555;">
      欲報名導覽員，請至天文台網站線上報名
    </td>
  </tr>
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
        如需關閉提醒信件，請至網站 → 成員入口 → 編輯資料中取消勾選<br>
        此為系統自動發送之通知郵件，請勿直接回覆。<br>
        This is an automated notification. Please do not reply to this email.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendAnnouncementEmails(event: {
  id: string;
  title: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  estimatedVisitors: number | null;
  maxParticipants: number | null;
}): Promise<void> {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('[ANNOUNCEMENT] SMTP not configured — skipping email announcement.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const activeUsers = await db.user.findMany({
    where: { role: { not: 'PENDING' }, receiveEventEmails: true },
    select: {
      name: true,
      firstNameEn: true,
      lastNameEn: true,
      firstNameZh: true,
      lastNameZh: true,
      email: true,
      contactEmail: true,
    },
  });

  const d = event.date;
  const dateIcal = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  const dateStr = formatDate(event.date);

  let sent = 0;
  for (const user of activeUsers) {
    const to = user.contactEmail ?? user.email;
    const displayName = user.firstNameZh ?? user.firstNameEn ?? user.name ?? to;

    const html = buildAnnouncementEmailHtml({
      name: displayName,
      eventId: event.id,
      title: event.title,
      dateStr,
      dateIcal,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      description: event.description,
      estimatedVisitors: event.estimatedVisitors,
      maxParticipants: event.maxParticipants,
    });

    try {
      await transporter.sendMail({
        from: `NTHU Observatory <${SMTP_USER}>`,
        to,
        subject: `清大天文台 新活動公告：${event.title}`,
        html,
      });
      sent++;
      console.log(`[ANNOUNCEMENT] ✓ Sent to ${to}`);
    } catch (err) {
      console.error(`[ANNOUNCEMENT] ✗ Failed to send to ${to}:`, err);
    }
  }

  console.log(`[ANNOUNCEMENT] Done — ${sent}/${activeUsers.length} emails sent for "${event.title}".`);
}

export async function GET() {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const events = await db.event.findMany({
    orderBy: { date: 'asc' },
    include: { _count: { select: { participations: true } } },
  });

  return NextResponse.json(events.map(ev => ({
    ...ev,
    participantCount: ev._count.participations,
  })));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, description, date, startTime, endTime, location, isPublic, maxParticipants, estimatedVisitors, sendAnnouncement } = await request.json();
  if (!title || !date) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const event = await db.event.create({
    data: {
      title,
      description: description || null,
      date: new Date(date),
      startTime: startTime || null,
      endTime: endTime || null,
      location: location || null,
      isPublic: isPublic ?? true,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      estimatedVisitors: estimatedVisitors ? parseInt(estimatedVisitors) : null,
    },
    include: { _count: { select: { participations: true } } },
  });

  if (sendAnnouncement) {
    sendAnnouncementEmails(event).catch(err =>
      console.error('[ANNOUNCEMENT] Error sending announcement emails:', err)
    );
  }

  return NextResponse.json({ ...event, participantCount: event._count.participations }, { status: 201 });
}
