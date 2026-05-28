import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import SiteStats from "@/models/SiteStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await dbConnect();
    await SiteStats.updateOne(
      { key: "pageviews" },
      { $inc: { count: 1 } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
