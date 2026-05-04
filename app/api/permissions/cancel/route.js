import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";
import { hitBucket, rateLimitResponse } from "@/lib/rateLimit";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa, getOrCreateSid } from "@/lib/clientInfo";
import { isSameOrigin } from "@/lib/auth";

export async function POST(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);
  const { sid } = getOrCreateSid();

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const limit = await hitBucket({
    key: `cancel:ip:${ip}`,
    limit: 5,
    windowSec: 300,
  });
  if (!limit.ok) {
    logAction({
      actor: "ogrenci", action: "rate_blocked",
      meta: { rule: "cancel:ip", limit: limit.limit, windowSec: limit.windowSec },
      ip, sid, ua,
    });
    const r = rateLimitResponse(limit, "Çok fazla iptal denemesi.");
    return NextResponse.json(r.body, { status: r.status, headers: r.headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const id = body?.id;
  const okulNo = String(body?.okulNo || "").trim();
  if (!id || !okulNo) {
    return NextResponse.json({ error: "Eksik bilgi." }, { status: 400 });
  }

  try {
    await dbConnect();
    const gun = todayKey();
    const removed = await Permission.findOneAndDelete({
      _id: id,
      okulNo,
      gun,
      status: "beklemede",
    }).lean();

    if (!removed) {
      return NextResponse.json(
        { error: "Talep bulunamadı veya iptal edilemez." },
        { status: 404 }
      );
    }

    logAction({
      actor: "ogrenci",
      actorRef: okulNo,
      action: "cancel",
      target: removed._id,
      meta: { sinif: removed.sinif, sube: removed.sube },
      ip, sid, ua,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/permissions/cancel", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
