import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true" && session.user.role === "ADMIN";

  try {
    const schedules = await db.schedule.findMany({
      where: all ? {} : { userId: session.user.id },
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(schedules);
  } catch {
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description, date, startTime, endTime, telescope, isPublic } = body;

    if (!title || !date || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const schedule = await db.schedule.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        startTime,
        endTime,
        telescope: telescope || null,
        isPublic: isPublic ?? false,
        userId: session.user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing schedule ID" }, { status: 400 });
  }

  try {
    const schedule = await db.schedule.findUnique({ where: { id } });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    if (schedule.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.schedule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
