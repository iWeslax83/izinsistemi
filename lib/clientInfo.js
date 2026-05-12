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

export function extractMeta(request) {
  const h = request.headers;
  const get = (k, n = 200) => (h.get(k) || "").slice(0, n);
  return {
    ip: extractIp(request),
    ua: extractUa(request),
    acceptLanguage: get("accept-language", 120),
    referer: get("referer", 300),
    origin: get("origin", 120),
    forwardedFor: get("x-forwarded-for", 300),
    realIp: get("x-real-ip", 60),
    cfIp: get("cf-connecting-ip", 60),
    cfCountry: get("cf-ipcountry", 8),
    secChUa: get("sec-ch-ua", 200),
    secChUaPlatform: get("sec-ch-ua-platform", 40),
    secChUaMobile: get("sec-ch-ua-mobile", 10),
    dnt: get("dnt", 4),
  };
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
