import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";
import { verifyTeacherSession, isSameOrigin } from "@/lib/auth";
import { dateKeyDaysAgo } from "@/lib/date";
import { parseUa } from "@/lib/ua";

export const dynamic = "force-dynamic";

async function statsFor(filter) {
  const rows = await Permission.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        students: { $addToSet: "$okulNo" },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        distinctStudents: { $size: "$students" },
      },
    },
  ]);
  return rows[0] || { total: 0, distinctStudents: 0 };
}

async function firstSeen(filter) {
  const r = await Permission.findOne(filter)
    .sort({ createdAt: 1 })
    .select("createdAt")
    .lean();
  return r?.createdAt || null;
}

export async function GET(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!verifyTeacherSession()) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Geçersiz id" }, { status: 400 });
  }

  try {
    await dbConnect();
    let doc = await Permission.findById(id).lean();
    if (!doc) doc = await PermissionArchive.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }

    const m = doc.meta || {};
    const sid = m.sid || null;
    const ip = m.ip && m.ip !== "unknown" ? m.ip : null;
    const since7 = dateKeyDaysAgo(7);
    const since30 = dateKeyDaysAgo(30);

    const empty = { total: 0, distinctStudents: 0 };
    const [sid7, sid30, sidFirst, ip7, ip30, ipFirst] = await Promise.all([
      sid ? statsFor({ "meta.sid": sid, gun: { $gte: since7 } }) : empty,
      sid ? statsFor({ "meta.sid": sid, gun: { $gte: since30 } }) : empty,
      sid ? firstSeen({ "meta.sid": sid }) : null,
      ip ? statsFor({ "meta.ip": ip, gun: { $gte: since7 } }) : empty,
      ip ? statsFor({ "meta.ip": ip, gun: { $gte: since30 } }) : empty,
      ip ? firstSeen({ "meta.ip": ip }) : null,
    ]);

    const device = parseUa(m.ua || "");

    const flags = [];
    if (!sid) {
      flags.push({
        level: "med",
        text: "Bu talepte cihaz kimliği (cookie) yok — gizli pencere veya cookie'siz istemci olabilir.",
      });
    }
    if (!ip) {
      flags.push({
        level: "med",
        text: "IP bilgisi alınamadı (proxy başlıkları eksik).",
      });
    }

    return NextResponse.json({
      id: String(doc._id),
      device,
      ip,
      sid: sid ? sid.slice(0, 10) : null,
      sidFull: sid,
      sidStats: { last7: sid7, last30: sid30, firstSeen: sidFirst },
      ipStats: { last7: ip7, last30: ip30, firstSeen: ipFirst },
      flags,
      createdAt: doc.createdAt,
    });
  } catch (e) {
    console.error("GET /api/permissions/cluster", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
