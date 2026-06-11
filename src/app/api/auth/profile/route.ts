import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstNameEn: true, lastNameEn: true, firstNameZh: true, lastNameZh: true, contactEmail: true, receiveEventEmails: true, bio: true, website: true, department: true, showPublicProfile: true, showPublicEmail: true },
  });

  return NextResponse.json(user);
}

// Called after passkey — saves profile and promotes to MEMBER
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { firstNameEn, lastNameEn, firstNameZh, lastNameZh, contactEmail } = await request.json();

  if (!firstNameEn?.trim() || !lastNameEn?.trim() || !firstNameZh?.trim() || !lastNameZh?.trim()) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      firstNameEn: firstNameEn.trim(),
      lastNameEn: lastNameEn.trim(),
      firstNameZh: firstNameZh.trim(),
      lastNameZh: lastNameZh.trim(),
      contactEmail: contactEmail?.trim() || session.user.email,
      role: 'MEMBER',
    },
  });
  console.log('[profile POST] updated user id:', updated.id, 'role:', updated.role);

  return NextResponse.json({ ok: true });
}

// Called from profile edit in navbar — updates fields only, no role change
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { firstNameEn, lastNameEn, firstNameZh, lastNameZh, contactEmail, receiveEventEmails, bio, website, department, showPublicProfile, showPublicEmail } = await request.json();

  if (!firstNameEn?.trim() || !lastNameEn?.trim()) {
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
      receiveEventEmails: receiveEventEmails !== false,
      bio: bio?.trim() || null,
      website: website?.trim() || null,
      department: department?.trim() || null,
      showPublicProfile: showPublicProfile === true,
      showPublicEmail: showPublicEmail === true,
    },
  });

  return NextResponse.json({ ok: true });
}
