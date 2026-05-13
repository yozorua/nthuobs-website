import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const memberRoles = ["MEMBER", "OPERATOR", "MANAGER", "ADMIN"];

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;
    const isMember = memberRoles.includes(role ?? "");
    const userId = session?.user?.id;

    const events = await db.event.findMany({
      where: isMember ? undefined : { isPublic: true },
      orderBy: { date: "asc" },
      include: {
        _count: { select: { participations: true } },
        ...(isMember && userId
          ? { participations: { where: { userId }, select: { id: true } } }
          : {}),
      },
    });

    const result = events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: ev.location,
      isPublic: ev.isPublic,
      maxParticipants: ev.maxParticipants,
      estimatedVisitors: ev.estimatedVisitors,
      participantCount: ev._count.participations,
      participating: isMember
        ? (ev as typeof ev & { participations?: { id: string }[] }).participations?.length > 0
        : undefined,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
