// app/api/cron/archive/route.js
import { NextResponse } from "next/server";
import { runArchive } from "@/lib/archive";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const auth = request.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const result = await runArchive();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("archive cron hata", e);
    logAction({
      actor: "sistem", actorRef: "cron", action: "archive_fail",
      meta: { error: e.message },
    });
    return NextResponse.json({ error: "Arşiv başarısız" }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}
