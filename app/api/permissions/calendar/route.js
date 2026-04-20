// app/api/permissions/calendar/route.js
import { NextResponse } from "next/server";
import { countByDayAcrossCollections } from "@/lib/permissionQuery";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const ay = request.nextUrl.searchParams.get("ay") || "";
    if (!/^\d{4}-\d{2}$/.test(ay)) {
      return NextResponse.json(
        { error: "ay parametresi YYYY-MM formatında olmalı." },
        { status: 400 }
      );
    }

    const days = await countByDayAcrossCollections({ monthKey: ay });
    return NextResponse.json({ ay, days });
  } catch (e) {
    console.error("GET /api/permissions/calendar", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
