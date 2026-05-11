import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";
import { dateKeyDaysAgo } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const LOOKBACK_DAYS = 90;
const MIN_REPEATS = 2;
const MAX_LEN = 60;
const TOP_N = 12;

export async function GET() {
  try {
    await dbConnect();
    const since = dateKeyDaysAgo(LOOKBACK_DAYS);

    const pipeline = [
      { $match: { gun: { $gte: since } } },
      {
        $project: {
          neden: {
            $trim: {
              input: { $toLower: { $ifNull: ["$neden", ""] } },
            },
          },
        },
      },
      { $match: { neden: { $ne: "" } } },
      { $group: { _id: "$neden", total: { $sum: 1 } } },
      { $match: { total: { $gte: MIN_REPEATS } } },
      { $sort: { total: -1 } },
      { $limit: 50 },
    ];

    const [active, archived] = await Promise.all([
      Permission.aggregate(pipeline),
      PermissionArchive.aggregate(pipeline),
    ]);

    const merged = new Map();
    for (const r of [...active, ...archived]) {
      const key = r._id;
      if (!key || key.length > MAX_LEN) continue;
      merged.set(key, (merged.get(key) || 0) + r.total);
    }

    const reasons = Array.from(merged.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N)
      .map((r) => r.reason);

    return NextResponse.json({ reasons });
  } catch (e) {
    console.error("GET /api/permissions/reasons", e);
    return NextResponse.json({ reasons: [] });
  }
}
