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

// Collapse visually-equivalent reasons to a single key so the same reason
// written with different casing, spacing, punctuation or Turkish İ/I/i variants
// doesn't show up as several identical suggestion chips.
function foldKey(s) {
  return (s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıi̇]/g, "i") // dotless ı and combining-dot i -> i
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip remaining diacritics
    .replace(/[^a-zçğöşü0-9]+/g, " ") // punctuation -> space
    .trim()
    .replace(/\s+/g, " ");
}

export async function GET() {
  try {
    await dbConnect();
    const since = dateKeyDaysAgo(LOOKBACK_DAYS);

    // Group by the raw (trimmed) reason, preserving original casing so we can
    // pick the most common spelling as the display label. Folding happens below.
    const pipeline = [
      { $match: { gun: { $gte: since } } },
      {
        $project: {
          neden: { $trim: { input: { $ifNull: ["$neden", ""] } } },
        },
      },
      { $match: { neden: { $ne: "" } } },
      { $group: { _id: "$neden", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 200 },
    ];

    const [active, archived] = await Promise.all([
      Permission.aggregate(pipeline),
      PermissionArchive.aggregate(pipeline),
    ]);

    // For each folded key, keep the total count and the most common original
    // spelling to use as the display label.
    const groups = new Map();
    for (const r of [...active, ...archived]) {
      const original = r._id;
      if (!original || original.length > MAX_LEN) continue;
      const key = foldKey(original);
      if (!key) continue;
      const g = groups.get(key) || { count: 0, labels: new Map() };
      g.count += r.total;
      g.labels.set(original, (g.labels.get(original) || 0) + r.total);
      groups.set(key, g);
    }

    const reasons = Array.from(groups.values())
      .filter((g) => g.count >= MIN_REPEATS)
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N)
      .map((g) => {
        // representative label = most frequently used original spelling
        let best = "";
        let bestN = -1;
        for (const [label, n] of g.labels) {
          if (n > bestN) {
            bestN = n;
            best = label;
          }
        }
        return best;
      });

    return NextResponse.json({ reasons });
  } catch (e) {
    console.error("GET /api/permissions/reasons", e);
    return NextResponse.json({ reasons: [] });
  }
}
