import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";

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

    await dbConnect();
    const days = await Permission.aggregate([
      { $match: { gun: { $regex: `^${ay}-` } } },
      {
        $group: {
          _id: "$gun",
          count: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          gun: "$_id",
          count: 1,
          approved: 1,
        },
      },
      { $sort: { gun: 1 } },
    ]);

    return NextResponse.json({ ay, days });
  } catch (e) {
    console.error("GET /api/permissions/calendar", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
