import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import GalleryClient, { type GalleryItemData } from '@/components/gallery/GalleryClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Gallery' };

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  // Read role from DB so activation takes effect without re-login
  let sessionUserRole: string | null = null;
  if (session?.user?.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    sessionUserRole = dbUser?.role ?? null;
  }

  const items = await db.galleryItem.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameZh: true,
          lastNameZh: true,
        },
      },
    },
  });

  const serialized: GalleryItemData[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    type: item.type as 'IMAGE' | 'VIDEO',
    filename: item.filename,
    thumbname: item.thumbname,
    heroname: item.heroname ?? null,
    webname: item.webname ?? null,
    width: item.width,
    height: item.height,
    takenAt: item.takenAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    userId: item.userId,
    equipment: (item.equipment as GalleryItemData['equipment']) ?? null,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    links: (item.links as GalleryItemData['links']) ?? null,
    uploaderEn:
      [item.user.firstNameEn, item.user.lastNameEn].filter(Boolean).join(' ') ||
      item.user.name || '',
    uploaderZh:
      item.user.lastNameZh && item.user.firstNameZh
        ? `${item.user.lastNameZh}${item.user.firstNameZh}`
        : null,
  }));

  const sessionUserId = session?.user?.id ?? null;

  return (
    <GalleryClient
      initialItems={serialized}
      sessionUserId={sessionUserId}
      sessionUserRole={sessionUserRole}
      locale={locale}
    />
  );
}
