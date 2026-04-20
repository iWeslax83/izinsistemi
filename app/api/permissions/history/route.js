import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";

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

    await dbConnect();
    const items = await Permission.find({ okulNo })
      .select("adSoyad okulNo sinif sube baslangicDersi bitisDersi neden status gun createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/permissions/history", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
