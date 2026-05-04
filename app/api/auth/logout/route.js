import { NextResponse } from "next/server";
import { isSameOrigin, clearSessions } from "@/lib/auth";

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  clearSessions();
  return NextResponse.json({ ok: true });
}
