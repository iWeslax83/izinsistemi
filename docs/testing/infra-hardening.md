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
