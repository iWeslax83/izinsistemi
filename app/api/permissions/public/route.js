// app/api/permissions/public/route.js
import { NextResponse } from "next/server";
import { findAcrossCollections } from "@/lib/permissionQuery";
import { todayKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const requested = request.nextUrl.searchParams.get("gun");
    const gun = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : todayKey();

    const items = await findAcrossCollections({
      filter: { gun },
      projection: "adSoyad sinif sube baslangicDersi bitisDersi neden status createdAt",
      sort: { createdAt: 1 },
      limit: 500,
    });

    return NextResponse.json({ items, gun });
  } catch (e) {
    console.error("GET /api/permissions/public", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
