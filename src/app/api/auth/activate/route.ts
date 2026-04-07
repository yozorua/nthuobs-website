import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { passkey } = await request.json();
  const expected = process.env.REGISTER_PASSKEY;

  if (!expected || passkey !== expected) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
