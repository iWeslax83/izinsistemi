import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa } from "@/lib/clientInfo";
import { verifyTeacherSession, isSameOrigin } from "@/lib/auth";

export async function POST(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    if (!verifyTeacherSession()) {
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
    const [activeRes, archiveRes] = await Promise.all([
      Permission.updateMany(
        { _id: { $in: ids }, status: "beklemede" },
        { $set: { status: "approved" } }
      ),
      PermissionArchive.updateMany(
        { _id: { $in: ids }, status: "beklemede" },
        { $set: { status: "approved" } }
      ),
    ]);
    const modified =
      (activeRes.modifiedCount || 0) + (archiveRes.modifiedCount || 0);

    logAction({
      actor: "ogretmen",
      actorRef: "teacher",
      action: "approve",
      meta: { ids, count: modified },
      ip, ua,
    });

    return NextResponse.json({ ok: true, modified });
  } catch (e) {
    console.error("POST /api/permissions/approve", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
