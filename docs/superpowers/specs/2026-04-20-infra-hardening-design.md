# Altyapı Sertleştirme — Tasarım Belgesi

**Tarih:** 2026-04-20
**Kapsam:** Rate limit + bot koruması, audit log, otomatik arşivleme.
**Mevcut özellik listesindeki karşılıkları:** 14, 15, 16.

## Hedef

İzin sistemi büyüdükçe ihtiyaç duyulacak üç üretim temelini eklemek:

1. **Rate limit** — çoklu submit ve spam davranışını kısa pencerede engelle.
2. **Audit log** — öğrenci, öğretmen ve sistem eylemlerinin izlenebilir kaydı.
3. **Arşivleme** — 180 günden eski talepleri ayrı koleksiyona taşı; ana sorgular hızlı kalsın, geçmiş kaybolmasın.

Sonraki sprint'lerde gelecek *talep iptali (8)*, *red ile bildirim (3)* gibi özellikler audit log'a yaslanacağı için altyapı önce yapılıyor.

## Kapsam dışı

- Birim test altyapısı kurmak (Jest/Vitest). Manuel test checklist'i ile yetinilir.
- Bildirim (grup 1), öğrenci self-service (grup 2), analiz paneli (grup 3). Ayrı sprint'ler.

## Genel Mimari

### Yeni MongoDB koleksiyonları

- `RateLimitBucket` — IP/pencere başına sayaç. TTL index ile kendini temizler.
- `AuditLog` — tüm eylemlerin zaman serisi, 365 gün TTL.
- `PermissionArchive` — `Permission` ile aynı şema, 180 günden eski kayıtlar.

### Yeni kod bileşenleri

| Dosya | Sorumluluk |
|---|---|
| `lib/rateLimit.js` | `checkAndIncrement(key, limit, windowSec)` — atomik upsert. Fail-open. |
| `lib/audit.js` | `logAction({actor, actorRef, action, target, meta, ip, sid, ua})` — fire-and-forget. |
| `lib/archive.js` | `runArchive()` — batch taşıma + idempotent. |
| `lib/permissionQuery.js` | `findAcrossCollections({filter, limit, sort})` — aktif + arşiv birleşik sorgu. |
| `app/api/cron/archive/route.js` | Günlük cron endpoint'i, `CRON_SECRET` ile korumalı. |
| `app/api/admin/audit/route.js` | Öğretmen şifreli audit sorgu endpoint'i. |
| `app/ogretmen/log/page.js` | Audit log görüntüleyici. |

### Mevcut dosyalara etki

- `app/api/permissions/route.js` (POST/GET) — rate limit + audit log çağrıları.
- `app/api/permissions/approve/route.js` — audit log.
- `app/api/permissions/history/route.js`, `calendar/route.js`, `public/route.js` — `permissionQuery` helper'ı üzerinden arşiv entegrasyonu.
- `vercel.json` — günlük cron tanımı.
- `.env.local.example` — `CRON_SECRET` eklenir.
- `README.md` — ortam değişkenleri ve yeni sayfa/endpoint'ler.

### Bağımlılıklar

Ek npm paketi yok. Mongoose + Next.js mevcut yapısıyla.

## Rate Limit

### Kurallar

| Scope | Limit | Pencere | Davranış |
|---|---|---|---|
| **(b)** IP → `POST /api/permissions` | 5 | 60 sn | 429, "Çok hızlı gönderiyorsun, {X}s sonra tekrar dene." |
| **(c)** IP → farklı `okulNo` submit | 8 farklı okulNo | 60 sn | 429 + `rate_blocked` audit log |
| **(a)** IP → toplam istek | 120 | 60 sn | 429 (hafif bot/DDoS) |
| **Teacher login** yanlış şifre | 5 | 5 dk | 401 + geçici kilit, `login_locked` audit log |
| **okulNo → POST** (mevcut unique index) | 1 | Gün | DB-level; rate limit katmanından bağımsız. |

### Tasarım notları

- **IP bazlı günlük limit yok** — atölye paylaşımlı WiFi'sı false positive üretir. Tüm kurallar **saniye/dakika** penceresinde anormal davranışa odaklı.
- **Storage:** `RateLimitBucket` koleksiyonu. `key` = `{scope}:{identifier}:{windowBucket}`. Unique index + TTL index `expiresAt` üzerinde.
- **IP alma:** `x-forwarded-for` ilk değer → `x-real-ip` → fallback `"unknown"`.
- **Öğretmen bypass:** `x-teacher-password` doğruysa (b), (c), (a) bypass.
- **Client-side session cookie (`sid`):** HttpOnly, 90 gün. Rate limit'e dahil değil; sadece audit log korelasyonu için. IP paylaşımlı olsa bile istismarcının fingerprint'i.

### Uygulama deseni

Her route başında:

```js
const decision = await checkRateLimit(req, rules);
if (!decision.ok) {
  await logAction({ actor: "ogrenci", action: "rate_blocked", meta: decision });
  return Response.json({ error: decision.message }, { status: 429 });
}
```

### Hata politikası

DB unreachable → **fail-open** (limit atla, `console.error`). İzin sisteminin çökmesi rate limit ihlalinden daha kötü.

## Audit Log

### Şema

```
{
  at: Date (indexed, default now, TTL 365 gün),
  actor: "ogrenci" | "ogretmen" | "sistem",
  actorRef: String,      // okulNo | "teacher" | "cron"
  action: String,
  target: ObjectId,      // Permission._id opsiyonel
  meta: Mixed,
  ip: String,
  sid: String,
  ua: String             // user-agent kısaltılmış
}
```

### Action kataloğu

| Actor | Action | Meta örneği |
|---|---|---|
| ogrenci | `submit` | `{okulNo, sinif, sube, dersler, neden}` |
| ogrenci | `cancel` | `{okulNo}` (8. özelliğe hazır) |
| ogrenci | `rate_blocked` | `{rule, limit, windowSec}` |
| ogretmen | `login_success` | — |
| ogretmen | `login_fail` | `{attempts}` |
| ogretmen | `login_locked` | `{until}` |
| ogretmen | `approve` | `{ids: [...], count}` |
| sistem | `archive_run` | `{moved, cutoffDate, durationMs}` |
| sistem | `archive_fail` | `{error}` |

### Yazım deseni

`logAction()` asenkron **fire-and-forget**. Ana istek akışını bloklamaz; DB yazım hatası `console.error`'a düşer. **Şifreler asla loglanmaz.**

### Görüntüleyici — `/ogretmen/log`

- Öğretmen şifresi (`x-teacher-password`) ile `/api/admin/audit` üzerinden okur.
- Ters kronolojik, sayfalama 50'şer.
- Filtreler: actor, action, tarih aralığı, okulNo.
- Sade tablo: zaman · aktör · aksiyon · hedef · meta özeti.
- JSON export butonu.

## Arşivleme

### Koleksiyon: `PermissionArchive`

`Permission` ile **birebir aynı şema**, aynı `_id` korunur. Arşivde `okulNo + gun` unique kuralı **gevşetilir** (taşındıktan sonra çakışma olmasın).

### Cutoff

`gun < (bugün - 180 gün)`. `YYYY-MM-DD` string karşılaştırması sıralı olduğu için hızlı.

### Cron endpoint: `POST /api/cron/archive`

- Header: `Authorization: Bearer ${CRON_SECRET}` zorunlu.
- Adımlar:
  1. Cutoff'tan eski kayıtları batch halinde (1000'er) oku.
  2. `PermissionArchive.insertMany(batch, {ordered: false})` — duplicate `_id` tolere.
  3. `Permission.deleteMany({_id: {$in: insertedIds}})`.
  4. `sistem/archive_run` audit log: `{moved, cutoffDate, durationMs}`.
- Hata → `sistem/archive_fail` + 500 (Vercel retry'a bırakılır).
- **Idempotent:** çift çalışırsa duplicate insert'leri yutar, kalan `Permission`'ları siler.

### Tetikleyici: Vercel Cron

`vercel.json` — günde bir kez **03:00 TR (00:00 UTC)**. Dev'de manuel `curl`.

### Okuma endpoint'lerine etki

| Endpoint | Değişiklik |
|---|---|
| `POST /api/permissions` | Yok — her zaman aktif koleksiyona yazar. |
| `GET /api/permissions` (bugün) | Yok — bugün asla arşivde olmaz. |
| `GET /api/permissions/public?gun=...` | `permissionQuery.findAcrossCollections` — tarih arşivdeyse oradan okur. |
| `GET /api/permissions/calendar?ay=...` | Union query — iki koleksiyondan birleştir. |
| `GET /api/permissions/history?okulNo=...` | Son 50 — iki koleksiyondan birleştir, sırala, kes. |
| `GET /api/permissions/students?q=...` | Değişmez — autocomplete sadece aktif koleksiyonda. |

**Ortak helper:** `lib/permissionQuery.js` iki fonksiyon sunar:
- `findAcrossCollections({filter, limit, sort})` — `public`, `history` için doküman listesi.
- `countByDayAcrossCollections({monthKey})` — `calendar` için `{gun, count, approved}` aggregate'i; iki koleksiyonun `$group` sonuçlarını gün bazında birleştirir.

Her endpoint'te ayrı union kodu olmasın.

## Hata Yönetimi

| Bileşen | Hata | Davranış |
|---|---|---|
| Rate limit | DB unreachable | Fail-open, log |
| Audit log | DB write hatası | Fail-silent, log |
| Arşiv cron | Batch hatası | 500, Vercel retry. Kısmî başarı OK (idempotent). |
| Arşiv helper | Archive koleksiyonu boş | Sadece aktif koleksiyona sorar, boş merge. |

## Test Yaklaşımı

Projede Jest/Vitest yok; birim test altyapısı bu sprint'in kapsamı dışında.

**Manuel test checklist** — `docs/testing/infra-hardening.md` olarak yazılır:

1. Dk'da 6 `POST /api/permissions` → 6.'sı 429.
2. Dk'da 9 farklı `okulNo` → 9.'su 429 + `rate_blocked` audit satırı.
3. Öğretmen 5 yanlış şifre → 6.'da 5 dk kilit.
4. Onay sonrası `/ogretmen/log` → `approve` satırı ve ID'ler görünür.
5. `gun = 200 gün önce` seed → `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/archive` → kayıt `PermissionArchive`'e taşınır.
6. `/takvim` ve `/gecmis` 180 gün öncesini gösterdiğinde arşivden okuma.

## Uygulama Sırası

Beş bağımsız aşama, her biri ayrı commit:

1. **Modeller + helper'lar** — kırılma yok.
   - `models/AuditLog.js`, `models/RateLimitBucket.js`, `models/PermissionArchive.js`
   - `lib/rateLimit.js`, `lib/audit.js`, `lib/permissionQuery.js`
2. **Rate limit + audit mevcut endpoint'lere**
   - `POST /api/permissions`, `GET /api/permissions`, `POST /api/permissions/approve`
3. **Arşiv altyapısı**
   - `lib/archive.js`, `app/api/cron/archive/route.js`, `vercel.json`, `.env.local.example`
   - Okuma endpoint'leri (`public`, `calendar`, `history`) helper'a taşınır
4. **Log görüntüleyici**
   - `app/api/admin/audit/route.js`, `app/ogretmen/log/page.js`
5. **Manuel test + README güncelleme**

## Gelecek Özelliklere Etkisi

- **(8) Talep iptali** — `cancel` audit action'ı zaten katalogda; iptal endpoint'i `logAction` çağırır.
- **(3) Talep reddi** — `reject` action'ı eklenir, `Permission.status` enum'una `reddedildi` eklenir.
- **(10) İstatistik paneli** — audit log'daki `submit` sayıları ve `Permission` + `PermissionArchive` birleşimi üzerinden türetilir.
