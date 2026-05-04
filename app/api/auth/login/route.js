import { NextResponse } from "next/server";
import {
  isSameOrigin,
  checkTeacherPassword,
  checkAdminPassword,
  issueTeacherSession,
  issueAdminSession,
} from "@/lib/auth";
import { hitBucket, rateLimitResponse, clearBucketsWithPrefix } from "@/lib/rateLimit";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa } from "@/lib/clientInfo";

export async function POST(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const lockState = await hitBucket({
    key: `login:ip:${ip}`,
    limit: 5,
    windowSec: 300,
    failClosed: true,
  });
  if (!lockState.ok) {
    logAction({
      actor: "ogretmen",
      action: "login_locked",
      meta: {
        until: new Date(Date.now() + lockState.retryAfter * 1000),
        reason: lockState.failClosed ? "db_unavailable" : "too_many_attempts",
      },
      ip, ua,
    });
    const r = rateLimitResponse(lockState, "Çok fazla başarısız giriş.");
    return NextResponse.json(r.body, { status: 429, headers: r.headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const role = body?.role === "admin" ? "admin" : "teacher";
  const password = body?.password;

  const ok = role === "admin"
    ? checkAdminPassword(password)
    : checkTeacherPassword(password);

  if (!ok) {
    logAction({
      actor: role === "admin" ? "sistem" : "ogretmen",
      action: "login_fail",
      meta: { role, attempts: lockState.count },
      ip, ua,
    });
    return NextResponse.json({ error: "Şifre hatalı." }, { status: 401 });
  }

  if (role === "admin") issueAdminSession();
  else issueTeacherSession();

  await clearBucketsWithPrefix(`login:ip:${ip}`);
  logAction({
    actor: role === "admin" ? "sistem" : "ogretmen",
    actorRef: role,
    action: "login_success",
    ip, ua,
  });

  return NextResponse.json({ ok: true, role });
}
