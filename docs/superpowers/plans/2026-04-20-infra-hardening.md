# Altyapı Sertleştirme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-20-infra-hardening-design.md`

**Goal:** İzin sistemine rate limit, audit log ve arşivleme altyapısını katmak. Üretim güvenilirliği için önemli; sonraki sprint'lerdeki iptal/red özellikleri bu altyapıya yaslanacak.

**Architecture:** Üç yeni Mongoose koleksiyonu (`RateLimitBucket`, `AuditLog`, `PermissionArchive`); mevcut endpoint'lere ince helper'lar üzerinden (fail-open rate limit, fire-and-forget audit log) entegre; Vercel Cron ile günlük arşiv job. Okuma endpoint'leri `permissionQuery` helper'ı üzerinden aktif + arşiv koleksiyonunu birleşik sorgular.

**Tech Stack:** Next.js 14 App Router (Node runtime), MongoDB + Mongoose, Vercel Cron.

**Test stratejisi:** Projede Jest/Vitest yok (spec kararı). Her task sonunda **manuel doğrulama** (curl/tarayıcı) ve `npm run lint`. Aşama sonunda `npm run build`. Tüm manuel checklist Task 20'de `docs/testing/infra-hardening.md`'e yazılır.

---

## Dosya Yapısı

**Oluşturulacak:**
- `models/RateLimitBucket.js`
- `models/AuditLog.js`
- `models/PermissionArchive.js`
- `lib/rateLimit.js`
- `lib/audit.js`
- `lib/permissionQuery.js`
- `lib/archive.js`
- `lib/clientInfo.js` (IP/UA/sid çıkarma)
- `app/api/cron/archive/route.js`
- `app/api/admin/audit/route.js`
- `app/ogretmen/log/page.js`
- `vercel.json`
- `docs/testing/infra-hardening.md`

**Değiştirilecek:**
- `app/api/permissions/route.js` (POST rate limit + audit, GET login audit/kilit)
- `app/api/permissions/approve/route.js` (audit)
- `app/api/permissions/public/route.js` (permissionQuery)
- `app/api/permissions/calendar/route.js` (permissionQuery)
- `app/api/permissions/history/route.js` (permissionQuery)
- `README.md`

Yeni bir `.env.local.example` dosyası oluşturulacak (status'te `D` işaretli — silinmiş).

---

## Aşama 1 — Modeller ve Helper'lar

### Task 1: `RateLimitBucket` modeli

**Files:**
- Create: `models/RateLimitBucket.js`

- [ ] **Step 1: Modeli yaz**

```js
// models/RateLimitBucket.js
import mongoose from "mongoose";

const RateLimitBucketSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    windowStart: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: false }
);

export default mongoose.models.RateLimitBucket ||
  mongoose.model("RateLimitBucket", RateLimitBucketSchema);
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: Başarılı (warning yoksa).

- [ ] **Step 3: Commit**

```bash
git add models/RateLimitBucket.js
git commit -m "feat: add RateLimitBucket model with TTL index"
```

---

### Task 2: `AuditLog` modeli

**Files:**
- Create: `models/AuditLog.js`

- [ ] **Step 1: Modeli yaz**

```js
// models/AuditLog.js
import mongoose from "mongoose";

const AUDIT_TTL_SECONDS = 365 * 24 * 60 * 60;

const AuditLogSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
      index: { expires: AUDIT_TTL_SECONDS },
    },
    actor: {
      type: String,
      enum: ["ogrenci", "ogretmen", "sistem"],
      required: true,
      index: true,
    },
    actorRef: { type: String, default: "" },
    action: { type: String, required: true, index: true },
    target: { type: mongoose.Schema.Types.ObjectId, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    sid: { type: String, default: "", index: true },
    ua: { type: String, default: "" },
  },
  { timestamps: false }
);

AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ actor: 1, action: 1, at: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", AuditLogSchema);
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: Başarılı.

- [ ] **Step 3: Commit**

```bash
git add models/AuditLog.js
git commit -m "feat: add AuditLog model with 365d TTL"
```

---

### Task 3: `PermissionArchive` modeli

**Files:**
- Create: `models/PermissionArchive.js`

- [ ] **Step 1: Modeli yaz**

`Permission` ile aynı alanlar, **`okulNo+gun` unique kuralı YOK** (arşivde çakışmayı tolere et). `timestamps: true` korunur.

```js
// models/PermissionArchive.js
import mongoose from "mongoose";

const PermissionArchiveSchema = new mongoose.Schema(
  {
    adSoyad: { type: String, required: true, trim: true },
    okulNo: { type: String, required: true, trim: true, index: true },
    sinif: { type: Number, required: true, min: 9, max: 12 },
    sube: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D", "E", "F", "G"],
    },
    baslangicDersi: { type: Number, required: true, min: 1, max: 10 },
    bitisDersi: { type: Number, required: true, min: 1, max: 10 },
    neden: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["beklemede", "approved"],
      default: "beklemede",
    },
    gun: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.PermissionArchive ||
  mongoose.model("PermissionArchive", PermissionArchiveSchema);
```

- [ ] **Step 2: Commit**

```bash
git add models/PermissionArchive.js
git commit -m "feat: add PermissionArchive model (no unique on okulNo+gun)"
```

---

### Task 4: `lib/clientInfo.js` — istek meta verisi çıkarıcı

**Files:**
- Create: `lib/clientInfo.js`

- [ ] **Step 1: Helper'ı yaz**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/clientInfo.js
git commit -m "feat: add client info helpers (ip/ua/sid cookie)"
```

---

### Task 5: `lib/audit.js` — audit helper'ı

**Files:**
- Create: `lib/audit.js`

- [ ] **Step 1: Helper'ı yaz**

```js
// lib/audit.js
import { dbConnect } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

export function logAction({
  actor,
  actorRef = "",
  action,
  target = null,
  meta = {},
  ip = "",
  sid = "",
  ua = "",
}) {
  (async () => {
    try {
      await dbConnect();
      await AuditLog.create({
        actor,
        actorRef,
        action,
        target,
        meta,
        ip,
        sid,
        ua,
      });
    } catch (e) {
      console.error("audit log yazılamadı", action, e.message);
    }
  })();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/audit.js
git commit -m "feat: add fire-and-forget audit logger"
```

---

### Task 6: `lib/rateLimit.js` — rate limit helper'ı

**Files:**
- Create: `lib/rateLimit.js`

- [ ] **Step 1: Helper'ı yaz**

```js
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

export function rateLimitResponse(decision, baseMessage) {
  const secs = decision.retryAfter || 60;
  const msg = `${baseMessage} ${secs} saniye sonra tekrar dene.`;
  return {
    status: 429,
    body: { error: msg, retryAfter: secs },
    headers: { "Retry-After": String(secs) },
  };
}
```

- [ ] **Step 2: `RateLimitBucket` şemasına `identifiers` alanını ekle**

Modify: `models/RateLimitBucket.js`

```js
// models/RateLimitBucket.js — güncel hali
import mongoose from "mongoose";

const RateLimitBucketSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    identifiers: { type: [String], default: [] },
    windowStart: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: false }
);

export default mongoose.models.RateLimitBucket ||
  mongoose.model("RateLimitBucket", RateLimitBucketSchema);
```

- [ ] **Step 3: Commit**

```bash
git add lib/rateLimit.js models/RateLimitBucket.js
git commit -m "feat: add rate limit helper (count + distinct) with fail-open"
```

---

### Task 7: `lib/permissionQuery.js` — aktif+arşiv birleşik sorgu

**Files:**
- Create: `lib/permissionQuery.js`

- [ ] **Step 1: Helper'ı yaz**

```js
// lib/permissionQuery.js
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";

export async function findAcrossCollections({
  filter,
  sort = { createdAt: -1 },
  limit = 50,
  projection = null,
}) {
  await dbConnect();
  const [active, archived] = await Promise.all([
    Permission.find(filter, projection).sort(sort).limit(limit).lean(),
    PermissionArchive.find(filter, projection).sort(sort).limit(limit).lean(),
  ]);
  const merged = [...active, ...archived];
  const sortKey = Object.keys(sort)[0];
  const sortDir = sort[sortKey] === 1 ? 1 : -1;
  merged.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return 0;
    return av > bv ? sortDir : -sortDir;
  });
  return merged.slice(0, limit);
}

export async function countByDayAcrossCollections({ monthKey }) {
  await dbConnect();
  const match = { $match: { gun: { $regex: `^${monthKey}-` } } };
  const group = {
    $group: {
      _id: "$gun",
      count: { $sum: 1 },
      approved: {
        $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
      },
    },
  };
  const project = {
    $project: { _id: 0, gun: "$_id", count: 1, approved: 1 },
  };
  const pipeline = [match, group, project];
  const [active, archived] = await Promise.all([
    Permission.aggregate(pipeline),
    PermissionArchive.aggregate(pipeline),
  ]);
  const map = new Map();
  for (const d of [...active, ...archived]) {
    const prev = map.get(d.gun) || { gun: d.gun, count: 0, approved: 0 };
    prev.count += d.count;
    prev.approved += d.approved;
    map.set(d.gun, prev);
  }
  return [...map.values()].sort((a, b) => (a.gun > b.gun ? 1 : -1));
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: Build başarılı (yeni modeller + helper'lar import edilebilir).

- [ ] **Step 3: Commit**

```bash
git add lib/permissionQuery.js
git commit -m "feat: add permissionQuery helper for active+archive union"
```

---

## Aşama 2 — Rate Limit & Audit Entegrasyonu

### Task 8: `POST /api/permissions` — rate limit + audit

**Files:**
- Modify: `app/api/permissions/route.js`

- [ ] **Step 1: POST handler'ı güncelle**

Alt satırları ekleyerek dosyayı değiştir. Mevcut validation'lar kalır.

```js
// app/api/permissions/route.js (sadece POST bölümü)
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { todayKey } from "@/lib/date";
import { hitBucket, hitDistinctBucket, rateLimitResponse } from "@/lib/rateLimit";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa, getOrCreateSid } from "@/lib/clientInfo";

export async function POST(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);
  const { sid } = getOrCreateSid();

  const teacherBypass =
    request.headers.get("x-teacher-password") === process.env.TEACHER_PASSWORD;

  if (!teacherBypass) {
    const perIp = await hitBucket({
      key: `post-permission:ip:${ip}`,
      limit: 5,
      windowSec: 60,
    });
    if (!perIp.ok) {
      logAction({
        actor: "ogrenci", action: "rate_blocked",
        meta: { rule: "post-permission:ip", limit: perIp.limit, windowSec: perIp.windowSec },
        ip, sid, ua,
      });
      const r = rateLimitResponse(perIp, "Çok hızlı gönderiyorsun.");
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const perAllIp = await hitBucket({
      key: `all:ip:${ip}`,
      limit: 120,
      windowSec: 60,
    });
    if (!perAllIp.ok) {
      logAction({
        actor: "ogrenci", action: "rate_blocked",
        meta: { rule: "all:ip", limit: perAllIp.limit, windowSec: perAllIp.windowSec },
        ip, sid, ua,
      });
      const r = rateLimitResponse(perAllIp, "Çok fazla istek.");
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
  }

  try {
    const body = await request.json();
    const { adSoyad, okulNo, sinif, sube, baslangicDersi, bitisDersi, neden } = body;

    if (
      !adSoyad || !okulNo || !sinif || !sube ||
      !baslangicDersi || !bitisDersi || !neden ||
      !String(neden).trim()
    ) {
      return NextResponse.json(
        { error: "Tüm alanların doldurulması zorunludur." },
        { status: 400 }
      );
    }

    const nedenTrim = String(neden).trim();
    if (nedenTrim.length > 200) {
      return NextResponse.json(
        { error: "Neden en fazla 200 karakter olabilir." },
        { status: 400 }
      );
    }

    if (Number(bitisDersi) < Number(baslangicDersi)) {
      return NextResponse.json(
        { error: "Bitiş dersi başlangıç dersinden küçük olamaz." },
        { status: 400 }
      );
    }

    const okulNoTrim = String(okulNo).trim();

    if (!teacherBypass) {
      const distinct = await hitDistinctBucket({
        key: `post-permission:distinct:ip:${ip}`,
        identifier: okulNoTrim,
        limit: 8,
        windowSec: 60,
      });
      if (!distinct.ok) {
        logAction({
          actor: "ogrenci", action: "rate_blocked",
          meta: { rule: "post-permission:distinct:ip", limit: distinct.limit, windowSec: distinct.windowSec },
          ip, sid, ua,
        });
        const r = rateLimitResponse(distinct, "Bu cihazdan çok fazla farklı öğrenci denendi.");
        return NextResponse.json(r.body, { status: r.status, headers: r.headers });
      }
    }

    await dbConnect();

    const gun = todayKey();
    const existing = await Permission.findOne({ okulNo: okulNoTrim, gun }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "Bugün zaten bir talebiniz bulunuyor." },
        { status: 409 }
      );
    }

    const doc = await Permission.create({
      adSoyad: String(adSoyad).trim(),
      okulNo: okulNoTrim,
      sinif: Number(sinif),
      sube: String(sube).toUpperCase(),
      baslangicDersi: Number(baslangicDersi),
      bitisDersi: Number(bitisDersi),
      neden: nedenTrim,
      gun,
      status: "beklemede",
    });

    logAction({
      actor: "ogrenci",
      actorRef: okulNoTrim,
      action: "submit",
      target: doc._id,
      meta: { sinif: doc.sinif, sube: doc.sube, baslangicDersi: doc.baslangicDersi, bitisDersi: doc.bitisDersi },
      ip, sid, ua,
    });

    return NextResponse.json({ ok: true, id: doc._id });
  } catch (e) {
    console.error("POST /api/permissions", e);
    return NextResponse.json(
      { error: "Sunucu hatası. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Manuel doğrulama**

MongoDB çalışır durumda. `npm run dev`.

```bash
# 6 hızlı POST — 6.'sı 429 olmalı
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/permissions \
    -H "Content-Type: application/json" \
    -d '{"adSoyad":"Test","okulNo":"T'$i'","sinif":9,"sube":"A","baslangicDersi":1,"bitisDersi":1,"neden":"test"}'
done
# Beklenen: 200/409,200/409,200/409,200/409,200/409,429
```

Mongo'da `auditlogs` koleksiyonunda `submit` ve/veya `rate_blocked` kayıtları olmalı.

- [ ] **Step 3: Commit**

```bash
git add app/api/permissions/route.js
git commit -m "feat: rate limit + audit log on POST /api/permissions"
```

---

### Task 9: `GET /api/permissions` — öğretmen login audit + kilit

**Files:**
- Modify: `app/api/permissions/route.js` (GET bölümü)

- [ ] **Step 1: GET handler'ı güncelle**

Dosyanın sonuna, mevcut `GET` yerine:

```js
export async function GET(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);

  const lockState = await hitBucket({
    key: `teacher-lock:ip:${ip}`,
    limit: 5,
    windowSec: 300,
  });
  if (!lockState.ok) {
    logAction({
      actor: "ogretmen", action: "login_locked",
      meta: { until: new Date(Date.now() + lockState.retryAfter * 1000) },
      ip, ua,
    });
    const r = rateLimitResponse(lockState, "Çok fazla başarısız giriş.");
    return NextResponse.json(r.body, { status: 429, headers: r.headers });
  }

  try {
    const auth = request.headers.get("x-teacher-password");
    if (!auth || auth !== process.env.TEACHER_PASSWORD) {
      logAction({
        actor: "ogretmen", action: "login_fail",
        meta: { attempts: lockState.count },
        ip, ua,
      });
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    await dbConnect();
    const gun = todayKey();
    const items = await Permission.find({ gun, status: "beklemede" })
      .sort({ createdAt: 1 })
      .lean();

    logAction({ actor: "ogretmen", actorRef: "teacher", action: "login_success", ip, ua });

    return NextResponse.json({ items, gun });
  } catch (e) {
    console.error("GET /api/permissions", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
```

**Not:** Sayaç başarısız/başarılı ayırt etmiyor — kasıtlı. 5 dk pencerede **herhangi 5 istek** eşiği dolurur; öğretmen doğru şifre girip arka arkaya çalışsa bile süslü bir threshold'da değil. Bu okul panelinde saniyede 5 login denemesi anormal davranış.

- [ ] **Step 2: Manuel doğrulama**

```bash
# 6 yanlış şifre — 6.'sı 429
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/permissions \
    -H "x-teacher-password: wrong"
done
# Beklenen: 401,401,401,401,401,429
```

- [ ] **Step 3: Commit**

```bash
git add app/api/permissions/route.js
git commit -m "feat: teacher login lock + audit on GET /api/permissions"
```

---

### Task 10: `POST /api/permissions/approve` — audit

**Files:**
- Modify: `app/api/permissions/approve/route.js`

- [ ] **Step 1: Audit çağrısı ekle**

```js
// app/api/permissions/approve/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import { logAction } from "@/lib/audit";
import { extractIp, extractUa } from "@/lib/clientInfo";

export async function POST(request) {
  const ip = extractIp(request);
  const ua = extractUa(request);
  try {
    const auth = request.headers.get("x-teacher-password");
    if (!auth || auth !== process.env.TEACHER_PASSWORD) {
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
    const res = await Permission.updateMany(
      { _id: { $in: ids }, status: "beklemede" },
      { $set: { status: "approved" } }
    );

    logAction({
      actor: "ogretmen",
      actorRef: "teacher",
      action: "approve",
      meta: { ids, count: res.modifiedCount },
      ip, ua,
    });

    return NextResponse.json({ ok: true, modified: res.modifiedCount });
  } catch (e) {
    console.error("POST /api/permissions/approve", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Aşama sonu lint + build**

Run: `npm run lint && npm run build`
Expected: Başarılı.

- [ ] **Step 3: Commit**

```bash
git add app/api/permissions/approve/route.js
git commit -m "feat: audit log on approve endpoint"
```

---

## Aşama 3 — Arşiv Altyapısı

### Task 11: `lib/archive.js` — batch taşıma

**Files:**
- Create: `lib/archive.js`

- [ ] **Step 1: Helper'ı yaz**

```js
// lib/archive.js
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";
import { logAction } from "@/lib/audit";

const ARCHIVE_DAYS = 180;
const BATCH_SIZE = 1000;

function cutoffKey(daysAgo = ARCHIVE_DAYS) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function runArchive() {
  const started = Date.now();
  await dbConnect();
  const cutoff = cutoffKey();

  let moved = 0;
  let lastBatch = BATCH_SIZE;

  while (lastBatch === BATCH_SIZE) {
    const batch = await Permission.find({ gun: { $lt: cutoff } })
      .sort({ gun: 1 })
      .limit(BATCH_SIZE)
      .lean();
    lastBatch = batch.length;
    if (batch.length === 0) break;

    try {
      await PermissionArchive.insertMany(batch, { ordered: false });
    } catch (e) {
      if (!e || e.code !== 11000) {
        throw e;
      }
    }

    const ids = batch.map((d) => d._id);
    const del = await Permission.deleteMany({ _id: { $in: ids } });
    moved += del.deletedCount;
  }

  const durationMs = Date.now() - started;
  logAction({
    actor: "sistem", actorRef: "cron", action: "archive_run",
    meta: { moved, cutoffDate: cutoff, durationMs },
  });

  return { moved, cutoffDate: cutoff, durationMs };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/archive.js
git commit -m "feat: add archive batch runner (180d cutoff, idempotent)"
```

---

### Task 12: `app/api/cron/archive/route.js` — cron endpoint

**Files:**
- Create: `app/api/cron/archive/route.js`

- [ ] **Step 1: Endpoint'i yaz**

```js
// app/api/cron/archive/route.js
import { NextResponse } from "next/server";
import { runArchive } from "@/lib/archive";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const auth = request.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const result = await runArchive();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("archive cron hata", e);
    logAction({
      actor: "sistem", actorRef: "cron", action: "archive_fail",
      meta: { error: e.message },
    });
    return NextResponse.json({ error: "Arşiv başarısız" }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/archive/route.js
git commit -m "feat: add /api/cron/archive endpoint protected by CRON_SECRET"
```

---

### Task 13: `vercel.json` + `.env.local.example`

**Files:**
- Create: `vercel.json`
- Create: `.env.local.example`

- [ ] **Step 1: `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/archive",
      "schedule": "0 0 * * *"
    }
  ]
}
```

(UTC 00:00 = TR 03:00. Vercel cron'u mevcut projelerde `GET` tetikler — bu yüzden route hem POST hem GET kabul ediyor.)

- [ ] **Step 2: `.env.local.example`**

```env
# MongoDB bağlantı URI'si (zorunlu)
MONGODB_URI=

# Öğretmen paneli şifresi (zorunlu)
TEACHER_PASSWORD=

# /api/cron/archive endpoint'i için bearer token (prod'da zorunlu)
CRON_SECRET=
```

- [ ] **Step 3: Manuel doğrulama**

```bash
# CRON_SECRET olmadan
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/cron/archive
# Beklenen: 401

# CRON_SECRET ile (test için .env.local'a ekle, dev sunucusunu yeniden başlat)
curl -s -X POST http://localhost:3000/api/cron/archive \
  -H "Authorization: Bearer $CRON_SECRET"
# Beklenen: {"ok":true,"moved":0,"cutoffDate":"...","durationMs":...}
```

- [ ] **Step 4: Commit**

```bash
git add vercel.json .env.local.example
git commit -m "feat: add Vercel cron config and env example"
```

---

### Task 14: `public/route.js` — `findAcrossCollections` kullan

**Files:**
- Modify: `app/api/permissions/public/route.js`

- [ ] **Step 1: Endpoint'i yeniden yaz**

```js
// app/api/permissions/public/route.js
import { NextResponse } from "next/server";
import { findAcrossCollections } from "@/lib/permissionQuery";
import { todayKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const requested = request.nextUrl.searchParams.get("gun");
    const gun = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : todayKey();

    const items = await findAcrossCollections({
      filter: { gun },
      projection: "adSoyad sinif sube baslangicDersi bitisDersi neden status createdAt",
      sort: { createdAt: 1 },
      limit: 500,
    });

    return NextResponse.json({ items, gun });
  } catch (e) {
    console.error("GET /api/permissions/public", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/permissions/public/route.js
git commit -m "feat: /public/route.js reads active+archive via helper"
```

---

### Task 15: `calendar/route.js` — `countByDayAcrossCollections`

**Files:**
- Modify: `app/api/permissions/calendar/route.js`

- [ ] **Step 1: Endpoint'i yeniden yaz**

```js
// app/api/permissions/calendar/route.js
import { NextResponse } from "next/server";
import { countByDayAcrossCollections } from "@/lib/permissionQuery";

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

    const days = await countByDayAcrossCollections({ monthKey: ay });
    return NextResponse.json({ ay, days });
  } catch (e) {
    console.error("GET /api/permissions/calendar", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/permissions/calendar/route.js
git commit -m "feat: /calendar/route.js aggregates across active+archive"
```

---

### Task 16: `history/route.js` — `findAcrossCollections`

**Files:**
- Modify: `app/api/permissions/history/route.js`

- [ ] **Step 1: Endpoint'i yeniden yaz**

```js
// app/api/permissions/history/route.js
import { NextResponse } from "next/server";
import { findAcrossCollections } from "@/lib/permissionQuery";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const okulNo = (request.nextUrl.searchParams.get("okulNo") || "").trim();
    if (!okulNo) {
      return NextResponse.json(
        { error: "Okul numarası zorunludur." },
        { status: 400 }
      );
    }

    const items = await findAcrossCollections({
      filter: { okulNo },
      projection: "adSoyad okulNo sinif sube baslangicDersi bitisDersi neden status gun createdAt",
      sort: { createdAt: -1 },
      limit: 50,
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/permissions/history", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Aşama sonu lint + build**

Run: `npm run lint && npm run build`
Expected: Başarılı.

- [ ] **Step 3: Commit**

```bash
git add app/api/permissions/history/route.js
git commit -m "feat: /history/route.js reads active+archive via helper"
```

---

## Aşama 4 — Audit Log Görüntüleyici

### Task 17: `app/api/admin/audit/route.js` — audit sorgu API'si

**Files:**
- Create: `app/api/admin/audit/route.js`

- [ ] **Step 1: Endpoint'i yaz**

```js
// app/api/admin/audit/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(request) {
  const auth = request.headers.get("x-teacher-password");
  if (!auth || auth !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const filter = {};
  const actor = sp.get("actor");
  const action = sp.get("action");
  const actorRef = sp.get("actorRef");
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, Number(sp.get("page") || "1"));

  if (actor) filter.actor = actor;
  if (action) filter.action = action;
  if (actorRef) filter.actorRef = actorRef;
  if (from || to) {
    filter.at = {};
    if (from) filter.at.$gte = new Date(from);
    if (to) filter.at.$lte = new Date(to);
  }

  try {
    await dbConnect();
    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return NextResponse.json({
      items, total, page, pageSize: PAGE_SIZE,
      hasMore: page * PAGE_SIZE < total,
    });
  } catch (e) {
    console.error("GET /api/admin/audit", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/audit/route.js
git commit -m "feat: add /api/admin/audit endpoint with filters + pagination"
```

---

### Task 18: `app/ogretmen/log/page.js` — log görüntüleyici UI

**Files:**
- Create: `app/ogretmen/log/page.js`

- [ ] **Step 1: Sayfayı yaz**

```jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ACTORS = ["", "ogrenci", "ogretmen", "sistem"];
const ACTIONS = [
  "", "submit", "cancel", "rate_blocked",
  "login_success", "login_fail", "login_locked", "approve",
  "archive_run", "archive_fail",
];

export default function AuditLogPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({ actor: "", action: "", actorRef: "", from: "", to: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("teacher-pwd");
      if (saved) {
        setPassword(saved);
        fetchPage(saved, 1, filters);
      }
    } catch {}
  }, []);

  const fetchPage = async (pwd, p, f) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (f.actor) qs.set("actor", f.actor);
      if (f.action) qs.set("action", f.action);
      if (f.actorRef) qs.set("actorRef", f.actorRef);
      if (f.from) qs.set("from", f.from);
      if (f.to) qs.set("to", f.to);
      qs.set("page", String(p));
      const res = await fetch(`/api/admin/audit?${qs.toString()}`, {
        headers: { "x-teacher-password": pwd },
      });
      if (res.status === 401) {
        setAuthed(false);
        setError("Şifre hatalı.");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setHasMore(!!data.hasMore);
      setPage(p);
      setAuthed(true);
      try { sessionStorage.setItem("teacher-pwd", pwd); } catch {}
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onLogin = (e) => {
    e.preventDefault();
    fetchPage(password, 1, filters);
  };

  const onFilter = (e) => {
    e.preventDefault();
    fetchPage(password, 1, filters);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-p${page}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={onLogin} className="card p-7 space-y-4 w-full max-w-sm">
          <div>
            <p className="eyebrow mb-2">Öğretmen · Log</p>
            <h1 className="display text-2xl font-semibold">Log paneli</h1>
          </div>
          <div>
            <label className="field-label">Şifre</label>
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Doğrulanıyor…" : "Giriş"}
          </button>
          {error && (
            <div className="rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
              {error}
            </div>
          )}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <nav className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/ogretmen" className="flex items-center gap-2.5">
            <span className="display text-[22px] font-bold leading-none">
              atölye<span className="text-accent">.</span>
            </span>
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              Log
            </span>
          </Link>
          <Link href="/ogretmen" className="btn-ghost">← Panel</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-8 pb-16">
        <header className="mb-6">
          <p className="eyebrow mb-2">Audit</p>
          <h1 className="display text-3xl font-semibold">Sistem kayıtları</h1>
          <p className="text-sm text-ink-muted mt-1">Toplam {total} kayıt · sayfa {page}</p>
        </header>

        <form onSubmit={onFilter} className="card p-4 mb-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <select
            className="field-input"
            value={filters.actor}
            onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
          >
            {ACTORS.map((a) => (
              <option key={a} value={a}>{a || "tüm aktörler"}</option>
            ))}
          </select>
          <select
            className="field-input"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a || "tüm aksiyonlar"}</option>
            ))}
          </select>
          <input
            className="field-input"
            placeholder="okulNo"
            value={filters.actorRef}
            onChange={(e) => setFilters({ ...filters, actorRef: e.target.value })}
          />
          <input
            type="datetime-local"
            className="field-input"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="datetime-local"
            className="field-input"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
          <div className="col-span-2 sm:col-span-5 flex gap-2 justify-end">
            <button type="button" onClick={exportJson} className="btn-secondary">
              JSON indir
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Yükleniyor…" : "Filtrele"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-5 rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
            {error}
          </div>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-ink-muted uppercase tracking-wider border-b border-line bg-paper">
                <th className="p-3 text-left font-medium">Zaman</th>
                <th className="p-3 text-left font-medium">Aktör</th>
                <th className="p-3 text-left font-medium">Ref</th>
                <th className="p-3 text-left font-medium">Aksiyon</th>
                <th className="p-3 text-left font-medium">IP</th>
                <th className="p-3 text-left font-medium">Meta</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-ink-muted" colSpan={6}>
                    Kayıt yok.
                  </td>
                </tr>
              ) : items.map((i) => (
                <tr key={i._id} className="border-b border-line/60 last:border-0 align-top">
                  <td className="p-3 text-ink-muted mark-number whitespace-nowrap">
                    {new Date(i.at).toLocaleString("tr-TR")}
                  </td>
                  <td className="p-3">{i.actor}</td>
                  <td className="p-3 text-ink-muted mark-number">{i.actorRef || "—"}</td>
                  <td className="p-3 font-medium">{i.action}</td>
                  <td className="p-3 text-ink-muted mark-number">{i.ip || "—"}</td>
                  <td className="p-3 text-xs text-ink-soft max-w-md">
                    <code className="break-words">{JSON.stringify(i.meta || {})}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between mt-5">
          <button
            className="btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => fetchPage(password, page - 1, filters)}
          >
            ← Önceki
          </button>
          <button
            className="btn-secondary"
            disabled={!hasMore || loading}
            onClick={() => fetchPage(password, page + 1, filters)}
          >
            Sonraki →
          </button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Öğretmen panelinden link ekle**

Modify: `app/ogretmen/page.js` — navigasyonda "Çıkış" butonu yanına `Link href="/ogretmen/log"` ekle.

`<button onClick={...} className="btn-ghost">Çıkış</button>` satırının hemen **öncesine** şunu ekle:

```jsx
<Link href="/ogretmen/log" className="btn-ghost">Log</Link>
```

- [ ] **Step 3: Aşama sonu lint + build**

Run: `npm run lint && npm run build`
Expected: Başarılı.

- [ ] **Step 4: Manuel doğrulama**

Tarayıcıda `http://localhost:3000/ogretmen/log` → şifre → önceki adımlardaki submit/approve/rate_blocked kayıtları görünür; filtre dropdown'ları çalışır; JSON indir butonu dosya üretir.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/audit/route.js app/ogretmen/log/page.js app/ogretmen/page.js
git commit -m "feat: add /ogretmen/log audit viewer with filters"
```

---

## Aşama 5 — Test Checklist & README

### Task 19: `docs/testing/infra-hardening.md` — manuel test kılavuzu

**Files:**
- Create: `docs/testing/infra-hardening.md`

- [ ] **Step 1: Kılavuzu yaz**

```markdown
# Altyapı Sertleştirme — Manuel Test Checklist

Test ortamı: `npm run dev`, `.env.local` içinde `MONGODB_URI`, `TEACHER_PASSWORD`, `CRON_SECRET`.

## Rate Limit

- [ ] **T1. Çoklu submit (b):** Aynı IP'den 60 sn içinde 6 `POST /api/permissions` → 6.'sı 429.

  ```bash
  for i in 1 2 3 4 5 6; do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/permissions \
      -H "Content-Type: application/json" \
      -d '{"adSoyad":"Test","okulNo":"T'$i'","sinif":9,"sube":"A","baslangicDersi":1,"bitisDersi":1,"neden":"test"}'
  done
  ```
  Beklenen: Son kodların 429 olması.

- [ ] **T2. Distinct okulNo (c):** 60 sn içinde 9 farklı `okulNo` → 9.'su 429 ve `rate_blocked` audit kaydı.

- [ ] **T3. Öğretmen login kilidi:** 5 yanlış şifre → 6. istek 429.

  ```bash
  for i in 1 2 3 4 5 6; do
    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/permissions \
      -H "x-teacher-password: wrong"
  done
  ```
  Beklenen: 401,401,401,401,401,429. Log'da `login_fail` ×5 + `login_locked` ×1.

- [ ] **T4. Öğretmen bypass:** Doğru şifreyle 6+ POST → hiçbiri 429 olmaz.

## Audit Log

- [ ] **T5. Submit kaydı:** Form gönder → `/ogretmen/log`'da `ogrenci/submit` satırı, meta'da sınıf/şube/ders.
- [ ] **T6. Approve kaydı:** Panelde onayla → `ogretmen/approve` satırı, meta'da `ids` dizisi.
- [ ] **T7. Filtreler:** `/ogretmen/log` sayfasında actor=ogrenci + action=submit filtresi çalışır.
- [ ] **T8. TTL:** `AuditLog` koleksiyonunda `at` üzerinde TTL index var (`getIndexes` ile doğrula).

  ```js
  db.auditlogs.getIndexes()
  // "at_1" index'inin expireAfterSeconds: 31536000 olduğunu kontrol et
  ```

## Arşivleme

- [ ] **T9. Cron auth:** `CRON_SECRET` olmadan `POST /api/cron/archive` → 401.
- [ ] **T10. Cron çalıştırma:** `.env.local`'da `CRON_SECRET` set, sonra:

  ```bash
  curl -s -X POST http://localhost:3000/api/cron/archive \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  Beklenen: `{"ok":true,"moved":0,"cutoffDate":"YYYY-MM-DD","durationMs":...}` + `archive_run` log.

- [ ] **T11. Arşive taşıma:** Mongo shell'de 200 gün önce tarihli test kaydı ekle:

  ```js
  db.permissions.insertOne({
    adSoyad: "Eski Kayıt", okulNo: "X999", sinif: 9, sube: "A",
    baslangicDersi: 1, bitisDersi: 1, neden: "eski",
    gun: "2025-10-01", status: "approved",
    createdAt: new Date("2025-10-01"), updatedAt: new Date("2025-10-01")
  })
  ```
  Cron'u tetikle → kayıt `permissionarchives`'e taşınır, `permissions`'tan silinir, `moved: 1`.

- [ ] **T12. Birleşik okuma:** `/takvim`'de o tarihin ayına git → gün hala sayılır; `/gecmis`'te `X999` sorgu → kayıt listede; `/api/permissions/public?gun=2025-10-01` → kayıt gelir.

- [ ] **T13. Idempotent cron:** Cron'u aynı veride 2. kez çalıştır → hata yok, `moved: 0`.

## Client Session Cookie

- [ ] **T14. `sid` cookie:** İlk form submit sonrası DevTools → Application → Cookies → `sid` 90 gün TTL, HttpOnly. Audit log'da `sid` alanı dolu.
```

- [ ] **Step 2: Commit**

```bash
git add docs/testing/infra-hardening.md
git commit -m "docs: add manual test checklist for infra hardening"
```

---

### Task 20: README güncelle

**Files:**
- Modify: `README.md`

- [ ] **Step 1: "Ortam Değişkenleri" tablosuna `CRON_SECRET` ekle**

Mevcut tablonun sonuna:

```md
| `CRON_SECRET` | `/api/cron/archive` endpoint'i için bearer token |
```

- [ ] **Step 2: "Sayfalar" bölümüne log sayfasını ekle**

Mevcut `/ogretmen` satırının hemen altına:

```md
- `/ogretmen/log` — Audit log görüntüleyici (şifre korumalı). Öğrenci/öğretmen/sistem
  eylemlerini filtreli listeler.
```

- [ ] **Step 3: "API" tablosuna yeni endpoint'leri ekle**

Mevcut tabloya yeni satırlar:

```md
| `GET` | `/api/admin/audit?actor=&action=&page=` | Audit log sorgulama (şifre korumalı) |
| `POST/GET` | `/api/cron/archive` | 180 günden eski kayıtları arşive taşır (bearer auth) |
```

- [ ] **Step 4: Yeni "Altyapı" bölümü ekle**

Dosyanın sonuna (PWA / Çevrimdışı bölümünden sonra):

```md
## Altyapı (Rate Limit / Audit / Arşiv)

- **Rate limit:** `lib/rateLimit.js` — MongoDB tabanlı, TTL temizlikli. Atölye
  WiFi için sadece dakika bazlı pencere kullanılır; günlük IP limiti yoktur.
  Öğretmen şifresi rate limit'i bypass eder.
- **Audit log:** `lib/audit.js` — öğrenci/öğretmen/sistem eylemleri, 365 gün TTL.
  Panel: `/ogretmen/log`.
- **Arşivleme:** `lib/archive.js` — 180 günden eski taleplerin ayrı
  `permissionarchives` koleksiyonuna taşınması. Cron: `vercel.json`, günde bir
  kez `CRON_SECRET` ile `/api/cron/archive` tetiklenir. Takvim/geçmiş sorguları
  `lib/permissionQuery.js` ile aktif + arşiv üzerinden birleşik çalışır.
- **Manuel test:** `docs/testing/infra-hardening.md`.
```

- [ ] **Step 5: Final lint + build**

Run: `npm run lint && npm run build`
Expected: Başarılı.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: update README with infra hardening features"
```

---

## Özet

| Aşama | Task'lar | Çıktı |
|---|---|---|
| 1 | 1–7 | Modeller + helper'lar |
| 2 | 8–10 | Rate limit + audit mevcut endpoint'lerde |
| 3 | 11–16 | Arşiv altyapısı + okuma endpoint'leri |
| 4 | 17–18 | Audit log görüntüleyici |
| 5 | 19–20 | Manuel test kılavuzu + README |

20 task · her biri bağımsız commit · aşama sonlarında `npm run build`.
