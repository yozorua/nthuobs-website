import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
import { join } from 'path';
import sharp from 'sharp';

const MEMBER_ROLES = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/tiff': 'tiff',
};
const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
};
const IMAGE_MAX = 100 * 1024 * 1024;
const VIDEO_MAX = 500 * 1024 * 1024;

function serializeItem(item: {
  id: string; title: string; description: string | null; category: string;
  type: string; filename: string; thumbname: string | null; heroname: string | null; webname: string | null; width: number | null;
  height: number | null; takenAt: Date | null; createdAt: Date; userId: string;
  equipment: unknown; lat: number | null; lng: number | null; links: unknown;
  user: { name: string | null; firstNameEn: string | null; lastNameEn: string | null; firstNameZh: string | null; lastNameZh: string | null };
}) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    type: item.type,
    filename: item.filename,
    thumbname: item.thumbname,
    heroname: item.heroname,
    webname: item.webname,
    width: item.width,
    height: item.height,
    takenAt: item.takenAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    userId: item.userId,
    equipment: item.equipment ?? null,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    links: (item.links as Array<{ title: string; url: string }> | null) ?? null,
    uploaderEn:
      [item.user.firstNameEn, item.user.lastNameEn].filter(Boolean).join(' ') ||
      item.user.name || '',
    uploaderZh:
      item.user.lastNameZh && item.user.firstNameZh
        ? `${item.user.lastNameZh}${item.user.firstNameZh}`
        : null,
  };
}

const userSelect = {
  name: true,
  firstNameEn: true,
  lastNameEn: true,
  firstNameZh: true,
  lastNameZh: true,
};

export async function GET() {
  const items = await db.galleryItem.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: userSelect } },
  });
  return NextResponse.json(items.map(serializeItem));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const dbUser = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!dbUser || !MEMBER_ROLES.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const category = (formData.get('category') as string) || 'other';
  const takenAtRaw = formData.get('takenAt') as string | null;
  const equipmentRaw = formData.get('equipment') as string | null;
  const latRaw = formData.get('lat') as string | null;
  const lngRaw = formData.get('lng') as string | null;
  const linksRaw = formData.get('links') as string | null;

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const isImage = file.type in IMAGE_TYPES;
  const isVideo = file.type in VIDEO_TYPES;
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const maxSize = isImage ? IMAGE_MAX : VIDEO_MAX;
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 });
  }

  let equipment: object | null = null;
  if (equipmentRaw) {
    try { equipment = JSON.parse(equipmentRaw); } catch { /* ignore malformed JSON */ }
  }
  const lat = latRaw !== null && latRaw !== '' ? Number(latRaw) : null;
  const lng = lngRaw !== null && lngRaw !== '' ? Number(lngRaw) : null;
  let links: Array<{ title: string; url: string }> | null = null;
  if (linksRaw) {
    try { links = JSON.parse(linksRaw); } catch { /* ignore malformed JSON */ }
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const id = crypto.randomUUID();
  const ext = isImage ? IMAGE_TYPES[file.type] : VIDEO_TYPES[file.type];
  const filename = `${id}.${ext}`;

  const galleryDir = join(process.cwd(), 'public', 'gallery');
  const thumbsDir = join(galleryDir, 'thumbs');
  await mkdir(galleryDir, { recursive: true });
  await mkdir(thumbsDir, { recursive: true });

  let thumbname: string | null = null;
  let heroname: string | null = null;
  let webname: string | null = null;
  let width: number | null = null;
  let height: number | null = null;

  // For images: validate, get dimensions, save original, then generate thumbnail
  if (isImage) {
    try {
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) throw new Error('No dimensions');
      width = meta.width;
      height = meta.height;
    } catch {
      return NextResponse.json({ error: 'Invalid or unsupported image file' }, { status: 400 });
    }
  }

  await writeFile(join(galleryDir, filename), buffer);

  if (isImage) {
    // Read from saved file on disk — avoids Sharp buffer-input issues
    const src = join(galleryDir, filename);
    try {
      const candidate = `${id}_thumb.jpg`;
      await sharp(src).resize(800, undefined, { withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(join(thumbsDir, candidate));
      thumbname = candidate;
    } catch (err) {
      console.error('[gallery] 800px thumbnail generation failed:', err);
    }
    try {
      const candidate = `${id}_hero.jpg`;
      await sharp(src).resize(1920, undefined, { withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(join(thumbsDir, candidate));
      heroname = candidate;
    } catch (err) {
      console.error('[gallery] 1920px hero thumbnail generation failed:', err);
    }
    if (file.type === 'image/tiff') {
      try {
        const candidate = `${id}_web.jpg`;
        await sharp(src).jpeg({ quality: 92 }).toFile(join(thumbsDir, candidate));
        webname = candidate;
      } catch (err) {
        console.error('[gallery] full-res TIFF conversion failed:', err);
      }
    }
  }

  if (isVideo) {
    try {
      const candidate = `${id}_thumb.jpg`;
      await execFileAsync('ffmpeg', [
        '-ss', '1', '-i', join(galleryDir, filename),
        '-vframes', '1', '-vf', 'scale=800:-1', '-q:v', '2', '-y', join(thumbsDir, candidate),
      ]);
      thumbname = candidate;
    } catch (err) {
      console.error('[gallery] video 800px thumbnail generation failed:', err);
    }
    try {
      const candidate = `${id}_hero.jpg`;
      await execFileAsync('ffmpeg', [
        '-ss', '1', '-i', join(galleryDir, filename),
        '-vframes', '1', '-vf', 'scale=1920:-1', '-q:v', '2', '-y', join(thumbsDir, candidate),
      ]);
      heroname = candidate;
    } catch (err) {
      console.error('[gallery] video 1920px hero thumbnail generation failed:', err);
    }
  }

  const item = await db.galleryItem.create({
    data: {
      id,
      userId: session.user.id,
      title,
      description,
      category,
      type: isImage ? 'IMAGE' : 'VIDEO',
      filename,
      thumbname,
      heroname,
      webname,
      width,
      height,
      takenAt: takenAtRaw ? new Date(takenAtRaw) : null,
      equipment: equipment ?? undefined,
      lat: lat !== null && !isNaN(lat) ? lat : null,
      lng: lng !== null && !isNaN(lng) ? lng : null,
      links: links ?? undefined,
    },
    include: { user: { select: userSelect } },
  });

  return NextResponse.json(serializeItem(item));
}
