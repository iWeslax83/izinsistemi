import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";
import { hitBucket, hitDistinctBucket, rateLimitResponse } from "@/lib/rateLimit";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa, extractMeta, getOrCreateSid } from "@/lib/clientInfo";
import { verifyTeacherSession, isSameOrigin } from "@/lib/auth";
import { validatePermissionInput } from "@/lib/permissionInput";

export async function POST(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);
  const { sid } = getOrCreateSid();

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const teacherBypass = verifyTeacherSession();

  if (!teacherBypass) {
    const perIp = await hitBucket({
      key: `post-permission:ip:${ip}`,
      limit: 5,
      windowSec: 60,
    });
    if (!perIp.ok) {
      logAction({
        actor: "ogrenci", action: "rate_blocked",
        meta: { rule: "post-permission:ip", limit: perIp.limit, windowSec: perIp.windowSec },
        ip, sid, ua,
      });
      const r = rateLimitResponse(perIp, "Çok hızlı gönderiyorsun.");
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const perAllIp = await hitBucket({
      key: `all:ip:${ip}`,
      limit: 120,
      windowSec: 60,
    });
    if (!perAllIp.ok) {
      logAction({
        actor: "ogrenci", action: "rate_blocked",
        meta: { rule: "all:ip", limit: perAllIp.limit, windowSec: perAllIp.windowSec },
        ip, sid, ua,
      });
      const r = rateLimitResponse(perAllIp, "Çok fazla istek.");
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
  }

  try {
    const body = await request.json();
    const parsed = validatePermissionInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { adSoyad, okulNo: okulNoTrim, sinif, sube, baslangicDersi, bitisDersi, neden: nedenTrim } = parsed.value;

    if (!teacherBypass) {
      const distinct = await hitDistinctBucket({
        key: `post-permission:distinct:ip:${ip}`,
        identifier: okulNoTrim,
        limit: 8,
        windowSec: 60,
      });
      if (!distinct.ok) {
        logAction({
          actor: "ogrenci", action: "rate_blocked",
          meta: { rule: "post-permission:distinct:ip", limit: distinct.limit, windowSec: distinct.windowSec },
          ip, sid, ua,
        });
        const r = rateLimitResponse(distinct, "Bu cihazdan çok fazla farklı öğrenci denendi.");
        return NextResponse.json(r.body, { status: r.status, headers: r.headers });
      }
    }

    await dbConnect();

    const gun = todayKey();
    const existing = await Permission.findOne({ okulNo: okulNoTrim, gun }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "Bugün zaten bir talebiniz bulunuyor." },
        { status: 409 }
      );
    }

    const doc = await Permission.create({
      adSoyad,
      okulNo: okulNoTrim,
      sinif,
      sube,
      baslangicDersi,
      bitisDersi,
      neden: nedenTrim,
      gun,
      status: "beklemede",
      meta: { ...extractMeta(request), sid },
    });

    logAction({
      actor: "ogrenci",
      actorRef: okulNoTrim,
      action: "submit",
      target: doc._id,
      meta: { sinif: doc.sinif, sube: doc.sube, baslangicDersi: doc.baslangicDersi, bitisDersi: doc.bitisDersi },
      ip, sid, ua,
    });

    return NextResponse.json({ ok: true, id: doc._id });
  } catch (e) {
    console.error("POST /api/permissions", e);
    return NextResponse.json(
      { error: "Sunucu hatası. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!verifyTeacherSession()) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const ip = extractIp(request);
  const ua = extractUa(request);
  const { sid } = getOrCreateSid();
  const perIp = await hitBucket({
    key: `get-permission:ip:${ip}`,
    limit: 120,
    windowSec: 60,
  });
  if (!perIp.ok) {
    logAction({
      actor: "ogretmen",
      action: "rate_blocked",
      meta: { rule: "get-permission:ip", limit: perIp.limit, windowSec: perIp.windowSec },
      ip, sid, ua,
    });
    const r = rateLimitResponse(perIp, "Çok hızlı sorguluyorsun.");
    return NextResponse.json(r.body, { status: r.status, headers: r.headers });
  }

  try {
    await dbConnect();
    const gun = todayKey();
    const items = await Permission.find({ gun, status: "beklemede" })
      .sort({ createdAt: 1 })
      .lean();
    return NextResponse.json({ items, gun });
  } catch (e) {
    console.error("GET /api/permissions", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
