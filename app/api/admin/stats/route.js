import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";
import { verifyAdminSession, verifyTeacherSession, isSameOrigin } from "@/lib/auth";
import { dateKeyDaysAgo, todayKey } from "@/lib/date";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

const STOPWORDS = new Set([
  "ve", "ile", "için", "icin", "bir", "de", "da", "den", "dan", "te", "ta",
  "ki", "ya", "ya da", "olan", "olarak", "var", "yok", "çok", "cok",
  "bu", "şu", "su", "o", "ben", "sen", "biz", "siz", "onlar",
  "ama", "fakat", "ancak", "ya", "ne", "gibi", "mi", "mı", "mu", "mü",
]);

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export async function GET(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!verifyAdminSession() && !verifyTeacherSession()) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const daysParam = Number(sp.get("days"));
  const days =
    Number.isFinite(daysParam) && daysParam > 0 && daysParam <= MAX_DAYS
      ? Math.floor(daysParam)
      : DEFAULT_DAYS;

  try {
    await dbConnect();
    const today = todayKey();
    const since = dateKeyDaysAgo(days);

    const dayPipeline = [
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
    ];

    const classPipeline = [
      { $match: { gun: { $gte: since, $lte: today } } },
      {
        $group: {
          _id: { sinif: "$sinif", sube: "$sube" },
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
        },
      },
    ];

    const hourPipeline = [
      { $match: { gun: { $gte: since, $lte: today } } },
      {
        $project: {
          hour: {
            $hour: { date: "$createdAt", timezone: "Europe/Istanbul" },
          },
        },
      },
      { $group: { _id: "$hour", total: { $sum: 1 } } },
    ];

    const lessonPipeline = [
      { $match: { gun: { $gte: since, $lte: today } } },
      {
        $group: {
          _id: "$baslangicDersi",
          total: { $sum: 1 },
        },
      },
    ];

    const reasonPipeline = [
      { $match: { gun: { $gte: since, $lte: today } } },
      { $project: { neden: 1 } },
    ];

    const runAll = async (Model) =>
      Promise.all([
        Model.aggregate(dayPipeline),
        Model.aggregate(classPipeline),
        Model.aggregate(hourPipeline),
        Model.aggregate(lessonPipeline),
        Model.aggregate(reasonPipeline),
      ]);

    const [activeRes, archiveRes] = await Promise.all([
      runAll(Permission),
      runAll(PermissionArchive),
    ]);

    const dayMap = new Map();
    for (const d of [...activeRes[0], ...archiveRes[0]]) {
      const prev = dayMap.get(d._id) || { gun: d._id, total: 0, approved: 0 };
      prev.total += d.total;
      prev.approved += d.approved;
      dayMap.set(d._id, prev);
    }
    const byDay = Array.from(dayMap.values()).sort((a, b) =>
      a.gun > b.gun ? 1 : -1
    );

    const classMap = new Map();
    for (const c of [...activeRes[1], ...archiveRes[1]]) {
      const key = `${c._id.sinif}-${c._id.sube}`;
      const prev = classMap.get(key) || {
        label: key,
        total: 0,
        approved: 0,
      };
      prev.total += c.total;
      prev.approved += c.approved;
      classMap.set(key, prev);
    }
    const byClass = Array.from(classMap.values()).sort(
      (a, b) => b.total - a.total
    );

    const hourMap = new Map();
    for (const h of [...activeRes[2], ...archiveRes[2]]) {
      hourMap.set(h._id, (hourMap.get(h._id) || 0) + h.total);
    }
    const byHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      total: hourMap.get(i) || 0,
    }));

    const lessonMap = new Map();
    for (const l of [...activeRes[3], ...archiveRes[3]]) {
      lessonMap.set(l._id, (lessonMap.get(l._id) || 0) + l.total);
    }
    const byLesson = Array.from(lessonMap.entries())
      .map(([lesson, total]) => ({ lesson, total }))
      .sort((a, b) => a.lesson - b.lesson);

    const wordCounts = new Map();
    let totalRecords = 0;
    let totalApproved = 0;
    for (const r of [...activeRes[4], ...archiveRes[4]]) {
      totalRecords += 1;
      for (const w of tokenize(r.neden)) {
        wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
      }
    }
    for (const day of byDay) totalApproved += day.approved;

    const topReasons = Array.from(wordCounts.entries())
      .map(([word, total]) => ({ word, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    return NextResponse.json({
      since,
      until: today,
      days,
      totals: {
        records: totalRecords,
        approved: totalApproved,
        pending: totalRecords - totalApproved,
      },
      byDay,
      byClass,
      byHour,
      byLesson,
      topReasons,
    });
  } catch (e) {
    console.error("GET /api/admin/stats", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
