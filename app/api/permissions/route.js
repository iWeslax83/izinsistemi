import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";

export async function POST(request) {
  try {
    const body = await request.json();
    const { adSoyad, okulNo, sinif, sube, baslangicDersi, bitisDersi, neden } = body;

    if (
      !adSoyad ||
      !okulNo ||
      !sinif ||
      !sube ||
      !baslangicDersi ||
      !bitisDersi ||
      !neden ||
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

    await dbConnect();

    const okulNoTrim = String(okulNo).trim();
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
