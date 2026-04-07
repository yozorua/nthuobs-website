import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstNameEn: true, lastNameEn: true, firstNameZh: true, lastNameZh: true, contactEmail: true, phone: true },
  });

  return NextResponse.json(user);
}

// Called after passkey — saves profile and promotes to MEMBER
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { firstNameEn, lastNameEn, firstNameZh, lastNameZh, contactEmail, phone } = await request.json();

  if (!firstNameEn?.trim() || !lastNameEn?.trim() || !firstNameZh?.trim() || !lastNameZh?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      firstNameEn: firstNameEn.trim(),
      lastNameEn: lastNameEn.trim(),
      firstNameZh: firstNameZh.trim(),
      lastNameZh: lastNameZh.trim(),
      contactEmail: contactEmail?.trim() || session.user.email,
      phone: phone.trim(),
      role: 'MEMBER',
    },
  });

  return NextResponse.json({ ok: true });
}

// Called from profile edit in navbar — updates fields only, no role change
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { firstNameEn, lastNameEn, firstNameZh, lastNameZh, contactEmail, phone } = await request.json();

  if (!firstNameEn?.trim() || !lastNameEn?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      firstNameEn: firstNameEn.trim(),
      lastNameEn: lastNameEn.trim(),
      firstNameZh: firstNameZh?.trim() || null,
      lastNameZh: lastNameZh?.trim() || null,
      contactEmail: contactEmail?.trim() || null,
      phone: phone.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}
