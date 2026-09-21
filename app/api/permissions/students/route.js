import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import Roster from "@/models/Roster";
import { escapeRegex } from "@/lib/auth";
import { extractIp } from "@/lib/clientInfo";
import { hitBucket, rateLimitResponse } from "@/lib/rateLimit";
import { mergeStudents } from "@/lib/roster";

export async function GET(request) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.length < 2 || q.length > 50) {
      return NextResponse.json({ students: [] });
    }

    // Uç nokta herkese açık ve ad + okul no döndürüyor, taramayı yavaşlat.
    const limit = await hitBucket({
      key: `students:ip:${extractIp(request)}`,
      limit: 60,
      windowSec: 60,
    });
    if (!limit.ok) {
      const r = rateLimitResponse(limit, "Çok fazla arama.");
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    await dbConnect();

    const prefix = { $regex: "^" + escapeRegex(q), $options: "i" };

    const [students, rosterRows] = await Promise.all([
      Permission.aggregate([
        { $match: { adSoyad: prefix } },
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
      ]).collation({ locale: "tr", strength: 2 }),
      Roster.find({ adSoyad: prefix })
        .collation({ locale: "tr", strength: 2 })
        .limit(8)
        .lean(),
    ]);

    return NextResponse.json({ students: mergeStudents(students, rosterRows) });
  } catch (e) {
    console.error("GET /api/permissions/students", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
