import crypto from "crypto";
import { cookies } from "next/headers";

const TEACHER_COOKIE = "izin_sess";
const ADMIN_COOKIE = "izin_admin";
const TEACHER_TTL_SEC = 60 * 60 * 12;
const ADMIN_TTL_SEC = 60 * 60;

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function checkTeacherPassword(candidate) {
  const expected = process.env.TEACHER_PASSWORD;
  if (!expected) return false;
  return safeEqual(String(candidate || ""), expected);
}

export function checkAdminPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD || process.env.TEACHER_PASSWORD;
  if (!expected) return false;
  return safeEqual(String(candidate || ""), expected);
}

export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function _signForTest(role, ttlSec) {
  return sign(role, ttlSec);
}

export function _verifyForTest(token, expectedRole) {
  return verify(token, expectedRole);
}

function sign(role, ttlSec) {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET missing or too short");
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ role, iat: now, exp: now + ttlSec }));
  const sig = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

function verify(token, expectedRole) {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expectedSig = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  let claims;
  try {
    claims = JSON.parse(b64urlDecode(payload).toString("utf8"));
  } catch {
    return false;
  }
  if (claims.role !== expectedRole) return false;
  if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

export function issueTeacherSession() {
  const token = sign("teacher", TEACHER_TTL_SEC);
  cookies().set(TEACHER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TEACHER_TTL_SEC,
  });
}

export function issueAdminSession() {
  const token = sign("admin", ADMIN_TTL_SEC);
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_TTL_SEC,
  });
}

export function clearSessions() {
  const opts = { path: "/", maxAge: 0 };
  cookies().set(TEACHER_COOKIE, "", opts);
  cookies().set(ADMIN_COOKIE, "", opts);
}

export function verifyTeacherSession() {
  const token = cookies().get(TEACHER_COOKIE)?.value;
  return token ? verify(token, "teacher") : false;
}

export function verifyAdminSession() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return token ? verify(token, "admin") : false;
}
