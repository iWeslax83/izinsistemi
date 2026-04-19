import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const gun = todayKey();
    const items = await Permission.find({ gun })
      .select("adSoyad sinif sube baslangicDersi bitisDersi status createdAt")
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({ items, gun });
  } catch (e) {
    console.error("GET /api/permissions/public", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
