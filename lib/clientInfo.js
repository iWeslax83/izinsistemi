// lib/clientInfo.js
import { cookies } from "next/headers";
import crypto from "crypto";

export function extractIp(request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  if (first) return first;
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function extractUa(request) {
  return (request.headers.get("user-agent") || "").slice(0, 200);
}

export function getOrCreateSid() {
  const store = cookies();
  const existing = store.get("sid")?.value;
  if (existing) return { sid: existing, isNew: false };
  const sid = crypto.randomBytes(16).toString("hex");
  store.set("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  return { sid, isNew: true };
}

export function readSid() {
  return cookies().get("sid")?.value || "";
}
