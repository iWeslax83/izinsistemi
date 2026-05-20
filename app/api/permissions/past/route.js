import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";
import { verifyTeacherSession, isSameOrigin } from "@/lib/auth";
import { todayKey, dateKeyDaysAgo } from "@/lib/date";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

export async function GET(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!verifyTeacherSession()) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const gun = sp.get("gun");

  if (gun) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gun)) {
      return NextResponse.json(
        { error: "Geçersiz gun parametresi." },
        { status: 400 }
      );
    }
    try {
      await dbConnect();
      const projection =
        "adSoyad okulNo sinif sube baslangicDersi bitisDersi neden status gun createdAt meta";
      const [active, archived] = await Promise.all([
        Permission.find({ gun }, projection).sort({ createdAt: 1 }).lean(),
        PermissionArchive.find({ gun }, projection).sort({ createdAt: 1 }).lean(),
      ]);
      const items = [...active, ...archived].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      return NextResponse.json({ gun, items });
    } catch (e) {
      console.error("GET /api/permissions/past?gun", e);
      return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
  }

  const daysParam = Number(sp.get("days"));
  const days =
    Number.isFinite(daysParam) && daysParam > 0 && daysParam <= MAX_DAYS
      ? Math.floor(daysParam)
      : DEFAULT_DAYS;

  try {
    await dbConnect();
    const today = todayKey();
    const since = dateKeyDaysAgo(days);

    const pipeline = [
      { $match: { gun: { $gte: since, $lte: today } } },
      {
        $group: {
          _id: "$gun",
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          gun: "$_id",
          total: 1,
          approved: 1,
          pending: { $subtract: ["$total", "$approved"] },
        },
      },
    ];

    const [active, archived] = await Promise.all([
      Permission.aggregate(pipeline),
      PermissionArchive.aggregate(pipeline),
    ]);

    const map = new Map();
    for (const d of [...active, ...archived]) {
      const prev = map.get(d.gun) || {
        gun: d.gun,
        total: 0,
        approved: 0,
        pending: 0,
      };
      prev.total += d.total;
      prev.approved += d.approved;
      prev.pending += d.pending;
      map.set(d.gun, prev);
    }
    const days_ = Array.from(map.values()).sort((a, b) =>
      a.gun > b.gun ? -1 : 1
    );

    return NextResponse.json({ days: days_, since, until: today });
  } catch (e) {
    console.error("GET /api/permissions/past", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
