import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";
import { logAction } from "@/lib/audit";
import {
  checkPermissionToken,
  validateBulkBody,
  candidateOkulNos,
  planBulk,
} from "@/lib/permissionInput";

const SOURCE = "stratos-admin";

export async function POST(request) {
  if (!checkPermissionToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = validateBulkBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await dbConnect();
    const gun = todayKey();
    const existing = await Permission.find(
      { gun, okulNo: { $in: candidateOkulNos(parsed.items) } },
      { okulNo: 1 }
    ).lean();

    const { results, toCreate } = planBulk(
      parsed.items,
      new Set(existing.map((e) => e.okulNo))
    );

    if (toCreate.length > 0) {
      const docs = await Permission.insertMany(
        toCreate.map((v) => ({
          ...v,
          gun,
          status: "beklemede",
          meta: { source: SOURCE },
        }))
      );
      for (const doc of docs) {
        logAction({
          actor: "sistem",
          actorRef: SOURCE,
          action: "submit",
          target: doc._id,
          meta: {
            source: SOURCE,
            okulNo: doc.okulNo,
            sinif: doc.sinif,
            sube: doc.sube,
            baslangicDersi: doc.baslangicDersi,
            bitisDersi: doc.bitisDersi,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("POST /api/permissions/bulk", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
