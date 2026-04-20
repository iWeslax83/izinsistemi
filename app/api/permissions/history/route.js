// app/api/permissions/history/route.js
import { NextResponse } from "next/server";
import { findAcrossCollections } from "@/lib/permissionQuery";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const okulNo = (request.nextUrl.searchParams.get("okulNo") || "").trim();
    if (!okulNo) {
      return NextResponse.json(
        { error: "Okul numarası zorunludur." },
        { status: 400 }
      );
    }

    const items = await findAcrossCollections({
      filter: { okulNo },
      projection: "adSoyad okulNo sinif sube baslangicDersi bitisDersi neden status gun createdAt",
      sort: { createdAt: -1 },
      limit: 50,
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/permissions/history", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
