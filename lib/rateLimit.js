// lib/rateLimit.js
import { dbConnect } from "@/lib/mongodb";
import RateLimitBucket from "@/models/RateLimitBucket";

export async function hitBucket({ key, limit, windowSec }) {
  try {
    await dbConnect();
    const now = new Date();
    const bucketStart = new Date(
      Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000
    );
    const expiresAt = new Date(bucketStart.getTime() + windowSec * 1000);
    const fullKey = `${key}:${bucketStart.getTime()}`;

    const doc = await RateLimitBucket.findOneAndUpdate(
      { key: fullKey },
      {
        $inc: { count: 1 },
        $setOnInsert: { windowStart: bucketStart, expiresAt },
      },
      { new: true, upsert: true }
    );

    const retryAfter = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)
    );

    return {
      ok: doc.count <= limit,
      count: doc.count,
      limit,
      windowSec,
      retryAfter,
    };
  } catch (e) {
    console.error("rate limit okunamadı (fail-open)", e.message);
    return { ok: true, count: 0, limit, windowSec, retryAfter: 0, failOpen: true };
  }
}

export async function hitDistinctBucket({ key, identifier, limit, windowSec }) {
  try {
    await dbConnect();
    const now = new Date();
    const bucketStart = new Date(
      Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000
    );
    const expiresAt = new Date(bucketStart.getTime() + windowSec * 1000);
    const fullKey = `${key}:${bucketStart.getTime()}:distinct`;

    const doc = await RateLimitBucket.findOneAndUpdate(
      { key: fullKey },
      {
        $addToSet: { identifiers: identifier },
        $setOnInsert: { windowStart: bucketStart, expiresAt, count: 0 },
      },
      { new: true, upsert: true }
    );

    const distinctCount = (doc.identifiers || []).length;
    const retryAfter = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)
    );

    return {
      ok: distinctCount <= limit,
      count: distinctCount,
      limit,
      windowSec,
      retryAfter,
    };
  } catch (e) {
    console.error("distinct rate limit okunamadı (fail-open)", e.message);
    return { ok: true, count: 0, limit, windowSec, retryAfter: 0, failOpen: true };
  }
}

export async function clearBucketsWithPrefix(prefix) {
  try {
    await dbConnect();
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await RateLimitBucket.deleteMany({ key: new RegExp(`^${escaped}:`) });
  } catch (e) {
    console.error("bucket temizlenemedi", e.message);
  }
}

export function rateLimitResponse(decision, baseMessage) {
  const secs = decision.retryAfter || 60;
  const msg = `${baseMessage} ${secs} saniye sonra tekrar dene.`;
  return {
    status: 429,
    body: { error: msg, retryAfter: secs },
    headers: { "Retry-After": String(secs) },
  };
}
