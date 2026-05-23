import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const memberRoles = ["MEMBER", "OPERATOR", "MANAGER", "ADMIN"];

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!dbUser || !memberRoles.includes(dbUser.role)) return null;
  return session;
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: eventId } = await params;
  const userId = session.user!.id;

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { participations: true } } },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (event.maxParticipants !== null && event._count.participations >= event.maxParticipants) {
    return NextResponse.json({ error: "Event is full" }, { status: 409 });
  }

  await db.eventParticipation.upsert({
    where: { userId_eventId: { userId, eventId } },
    create: { userId, eventId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: eventId } = await params;
  const userId = session.user!.id;

  await db.eventParticipation.deleteMany({ where: { userId, eventId } });
  return NextResponse.json({ ok: true });
}
