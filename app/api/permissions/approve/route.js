import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";

export async function POST(request) {
  try {
    const auth = request.headers.get("x-teacher-password");
    if (!auth || auth !== process.env.TEACHER_PASSWORD) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Onaylanacak kayıt seçilmedi." },
        { status: 400 }
      );
    }

    await dbConnect();
    const res = await Permission.updateMany(
      { _id: { $in: ids }, status: "beklemede" },
      { $set: { status: "approved" } }
    );

    return NextResponse.json({ ok: true, modified: res.modifiedCount });
  } catch (e) {
    console.error("POST /api/permissions/approve", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
