import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import { join } from 'path';

const MANAGE_ROLES = ['MANAGER', 'ADMIN'];

async function canModify(sessionUserId: string, role: string, itemUserId: string) {
  return itemUserId === sessionUserId || MANAGE_ROLES.includes(role);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const dbUser = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const role = dbUser?.role ?? '';

  const { id } = await params;
  const item = await db.galleryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await canModify(session.user.id, role, item.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updated = await db.galleryItem.update({
    where: { id },
    data: {
      title: body.title ?? item.title,
      description: body.description !== undefined ? body.description : item.description,
      category: body.category ?? item.category,
      takenAt: body.takenAt !== undefined ? (body.takenAt ? new Date(body.takenAt) : null) : item.takenAt,
      equipment: body.equipment !== undefined ? (body.equipment ?? undefined) : undefined,
      lat: body.lat !== undefined ? (body.lat ?? null) : item.lat,
      lng: body.lng !== undefined ? (body.lng ?? null) : item.lng,
      links: body.links !== undefined ? (body.links ?? undefined) : undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    category: updated.category,
    takenAt: updated.takenAt?.toISOString() ?? null,
    equipment: updated.equipment ?? null,
    lat: updated.lat ?? null,
    lng: updated.lng ?? null,
    links: updated.links ?? null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const dbUser = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const role = dbUser?.role ?? '';

  const { id } = await params;
  const item = await db.galleryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await canModify(session.user.id, role, item.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.galleryItem.delete({ where: { id } });

  const galleryDir = join(process.cwd(), 'public', 'gallery');
  try { await unlink(join(galleryDir, item.filename)); } catch { /* ignore */ }
  if (item.thumbname) {
    try { await unlink(join(galleryDir, 'thumbs', item.thumbname)); } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true });
}
