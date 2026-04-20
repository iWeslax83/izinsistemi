# Atölye İzin Otomasyon Sistemi

TOFAŞ Fen Lisesi İnovasyon Atölyesi için izin dilekçesi otomasyonu.
Next.js (App Router) + MongoDB (Mongoose) + Tailwind CSS + jsPDF. PWA destekli,
çevrimdışı talep kuyruğu var.

## Kurulum

```bash
npm install
cp .env.local.example .env.local   # MONGODB_URI ve TEACHER_PASSWORD değerlerini düzenle
npm run dev
```

### Ortam Değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `MONGODB_URI` | MongoDB bağlantı URI'si |
| `TEACHER_PASSWORD` | Öğretmen paneli şifresi |

## Sayfalar

- `/` — Öğrenci izin formu (giriş yok). Ad Soyad autocomplete + bugünkü taleplerin
  canlı listesi. Çevrimdışıysa talepler sıraya alınır, bağlantı gelince otomatik gönderilir.
- `/gecmis` — Öğrenci okul numarasıyla son 50 talebini görür.
- `/takvim` — Aylık takvim görünümü; güne tıklayınca o günün tüm talepleri listelenir.
- `/ogretmen` — Öğretmen paneli (şifre korumalı). Günün bekleyen taleplerini listeler,
  toplu onay + PDF üretimi sunar.

## Veri Modeli

`Permission`:

| Alan | Tip | Not |
| --- | --- | --- |
| `adSoyad` | String | Zorunlu |
| `okulNo` | String | Zorunlu |
| `sinif` | Number | 9–12 |
| `sube` | String | A–G |
| `baslangicDersi` / `bitisDersi` | Number | 1–10 |
| `neden` | String | Zorunlu, maks 200 karakter |
| `gun` | String | `YYYY-MM-DD` |
| `status` | `beklemede` / `approved` | |

Aynı öğrenci (okulNo) aynı gün birden fazla talep açamaz.

## API

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| `POST` | `/api/permissions` | Yeni talep oluşturur |
| `GET` | `/api/permissions` | `x-teacher-password` ile günün bekleyen talepleri |
| `POST` | `/api/permissions/approve` | Seçili talepleri onaylar |
| `GET` | `/api/permissions/public?gun=YYYY-MM-DD` | Herhangi bir günün public listesi |
| `GET` | `/api/permissions/history?okulNo=...` | Öğrencinin son 50 talebi |
| `GET` | `/api/permissions/calendar?ay=YYYY-MM` | Ay bazında gün × talep sayısı |
| `GET` | `/api/permissions/students?q=...` | Ad Soyad autocomplete kaynağı |

## PDF

`public/signature.png` dosyasını kendi imzanızla değiştirin. PDF üretimi istemci
tarafında `jspdf` + `jspdf-autotable` ile yapılır; tablo öğrencinin yazdığı
`Neden`'i de içerir. Türkçe karakter desteği için `public/fonts/NotoSans-*.ttf`
dosyaları gömülür.

## PWA / Çevrimdışı

- `public/sw.js` — shell cache + Background Sync.
- `lib/offlineQueue.js` — IndexedDB tabanlı talep kuyruğu.
- `app/sw-register.js` — Service Worker kaydı.

Çevrimdışıyken gönderilen talep IndexedDB'ye yazılır; ağ dönünce `permission-sync`
etiketiyle otomatik flush edilir.

## İş Akışı

1. Öğrenci formu doldurur (ad, sınıf, dersler, **neden**) → MongoDB'de
   `status: "beklemede"`.
2. Öğretmen `/ogretmen` paneline girer, günün taleplerini görür, nedenleri okur
   ve seçim yapar.
3. "Onayla & PDF" ile dilekçe indirilir ve seçili kayıtlar `status: "approved"`
   olur.
