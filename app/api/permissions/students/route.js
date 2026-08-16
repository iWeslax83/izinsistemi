import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { escapeRegex } from "@/lib/auth";

export async function GET(request) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.length < 2 || q.length > 50) {
      return NextResponse.json({ students: [] });
    }

    await dbConnect();

    const students = await Permission.aggregate([
      {
        $match: {
          adSoyad: { $regex: "^" + escapeRegex(q), $options: "i" },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { adSoyad: "$adSoyad", okulNo: "$okulNo" },
          sinif: { $first: "$sinif" },
          sube: { $first: "$sube" },
        },
      },
      {
        $project: {
          _id: 0,
          adSoyad: "$_id.adSoyad",
          okulNo: "$_id.okulNo",
          sinif: 1,
          sube: 1,
        },
      },
      { $limit: 8 },
    ]).collation({ locale: "tr", strength: 2 });

    return NextResponse.json({ students });
  } catch (e) {
    console.error("GET /api/permissions/students", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
