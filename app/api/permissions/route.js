import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";
import { hitBucket, hitDistinctBucket, rateLimitResponse } from "@/lib/rateLimit";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa, getOrCreateSid } from "@/lib/clientInfo";

export async function POST(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);
  const { sid } = getOrCreateSid();

  const teacherBypass =
    request.headers.get("x-teacher-password") === process.env.TEACHER_PASSWORD;

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
    const { adSoyad, okulNo, sinif, sube, baslangicDersi, bitisDersi, neden } = body;

    if (
      !adSoyad || !okulNo || !sinif || !sube ||
      !baslangicDersi || !bitisDersi || !neden ||
      !String(neden).trim()
    ) {
      return NextResponse.json(
        { error: "Tüm alanların doldurulması zorunludur." },
        { status: 400 }
      );
    }

    const nedenTrim = String(neden).trim();
    if (nedenTrim.length > 200) {
      return NextResponse.json(
        { error: "Neden en fazla 200 karakter olabilir." },
        { status: 400 }
      );
    }

    if (Number(bitisDersi) < Number(baslangicDersi)) {
      return NextResponse.json(
        { error: "Bitiş dersi başlangıç dersinden küçük olamaz." },
        { status: 400 }
      );
    }

    const okulNoTrim = String(okulNo).trim();

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
      adSoyad: String(adSoyad).trim(),
      okulNo: okulNoTrim,
      sinif: Number(sinif),
      sube: String(sube).toUpperCase(),
      baslangicDersi: Number(baslangicDersi),
      bitisDersi: Number(bitisDersi),
      neden: nedenTrim,
      gun,
      status: "beklemede",
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
  try {
    const auth = request.headers.get("x-teacher-password");
    if (!auth || auth !== process.env.TEACHER_PASSWORD) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

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
