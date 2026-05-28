import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import SiteStats from "@/models/SiteStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatCount(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v < 10 ? v.toFixed(1) : Math.round(v)}k`;
  }
  const v = n / 1_000_000;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}M`;
}

export async function GET() {
  let count = 0;
  try {
    await dbConnect();
    const doc = await SiteStats.findOne({ key: "pageviews" }).lean();
    count = doc?.count ?? 0;
  } catch {
    // fall through with count = 0
  }
  return NextResponse.json(
    {
      schemaVersion: 1,
      label: "views",
      message: formatCount(count),
      color: "blue",
      cacheSeconds: 300,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  );
}
