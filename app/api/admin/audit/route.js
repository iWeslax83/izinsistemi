// app/api/admin/audit/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(request) {
  const auth = request.headers.get("x-teacher-password");
  if (!auth || auth !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const filter = {};
  const actor = sp.get("actor");
  const action = sp.get("action");
  const actorRef = sp.get("actorRef");
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, Number(sp.get("page") || "1"));

  if (actor) filter.actor = actor;
  if (action) filter.action = action;
  if (actorRef) filter.actorRef = actorRef;
  if (from || to) {
    filter.at = {};
    if (from) filter.at.$gte = new Date(from);
    if (to) filter.at.$lte = new Date(to);
  }

  try {
    await dbConnect();
    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return NextResponse.json({
      items, total, page, pageSize: PAGE_SIZE,
      hasMore: page * PAGE_SIZE < total,
    });
  } catch (e) {
    console.error("GET /api/admin/audit", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
