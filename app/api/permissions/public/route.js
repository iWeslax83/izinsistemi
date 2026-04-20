import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const requested = request.nextUrl.searchParams.get("gun");
    const gun = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : todayKey();

    await dbConnect();
    const items = await Permission.find({ gun })
      .select("adSoyad sinif sube baslangicDersi bitisDersi neden status createdAt")
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({ items, gun });
  } catch (e) {
    console.error("GET /api/permissions/public", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
