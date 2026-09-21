import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Roster from "@/models/Roster";
import { checkRosterToken, validateRosterEntry } from "@/lib/roster";

const MAX_BATCH = 200;

function unauthorized() {
  return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
}

export async function POST(request) {
  if (!checkRosterToken(request.headers.get("authorization"))) return unauthorized();

  const body = await request.json().catch(() => null);
  const list = Array.isArray(body) ? body : body ? [body] : [];
  if (list.length === 0 || list.length > MAX_BATCH) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const values = [];
  for (const raw of list) {
    const result = validateRosterEntry(raw);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    values.push(result.value);
  }

  try {
    await dbConnect();
    await Roster.bulkWrite(
      values.map((v) => ({
        updateOne: { filter: { okulNo: v.okulNo }, update: { $set: v }, upsert: true },
      }))
    );
    return NextResponse.json({ ok: true, count: values.length });
  } catch (e) {
    console.error("POST /api/roster", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!checkRosterToken(request.headers.get("authorization"))) return unauthorized();

  const okulNo = request.nextUrl.searchParams.get("okulNo") || "";
  if (!/^\d{1,10}$/.test(okulNo)) {
    return NextResponse.json({ error: "Geçersiz okulNo" }, { status: 400 });
  }

  try {
    await dbConnect();
    await Roster.deleteOne({ okulNo });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/roster", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
