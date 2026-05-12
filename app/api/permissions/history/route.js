// app/api/permissions/history/route.js
import { NextResponse } from "next/server";
import { findAcrossCollections } from "@/lib/permissionQuery";
import { hitBucket, hitDistinctBucket, rateLimitResponse } from "@/lib/rateLimit";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa, getOrCreateSid } from "@/lib/clientInfo";
import { verifyTeacherSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);
  const { sid } = getOrCreateSid();
  const teacher = verifyTeacherSession();

  if (!teacher) {
    const perIp = await hitBucket({
      key: `history:ip:${ip}`,
      limit: 20,
      windowSec: 60,
    });
    if (!perIp.ok) {
      logAction({
        actor: "ogrenci",
        action: "rate_blocked",
        meta: { rule: "history:ip", limit: perIp.limit, windowSec: perIp.windowSec },
        ip,
        sid,
        ua,
      });
      const r = rateLimitResponse(perIp, "Çok hızlı sorguluyorsun.");
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
  }

  try {
    const okulNo = (request.nextUrl.searchParams.get("okulNo") || "").trim();
    if (!okulNo) {
      return NextResponse.json(
        { error: "Okul numarası zorunludur." },
        { status: 400 }
      );
    }
    if (okulNo.length > 12 || !/^[A-Za-z0-9]+$/.test(okulNo)) {
      return NextResponse.json(
        { error: "Geçersiz okul numarası." },
        { status: 400 }
      );
    }

    if (!teacher) {
      const distinct = await hitDistinctBucket({
        key: `history:distinct:ip:${ip}`,
        identifier: okulNo,
        limit: 8,
        windowSec: 300,
      });
      if (!distinct.ok) {
        logAction({
          actor: "ogrenci",
          action: "rate_blocked",
          meta: {
            rule: "history:distinct:ip",
            limit: distinct.limit,
            windowSec: distinct.windowSec,
          },
          ip,
          sid,
          ua,
        });
        const r = rateLimitResponse(
          distinct,
          "Bu cihazdan çok fazla farklı öğrenci sorgulandı."
        );
        return NextResponse.json(r.body, { status: r.status, headers: r.headers });
      }
    }

    const baseProjection =
      "adSoyad okulNo sinif sube baslangicDersi bitisDersi neden status gun createdAt";
    const items = await findAcrossCollections({
      filter: { okulNo },
      projection: teacher ? `${baseProjection} meta` : baseProjection,
      sort: { createdAt: -1 },
      limit: 50,
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/permissions/history", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
