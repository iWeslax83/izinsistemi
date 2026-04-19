# Atölye İzin Otomasyon Sistemi

TOFAŞ Fen Lisesi İnovasyon Atölyesi için izin dilekçesi otomasyonu.
Next.js (App Router) + MongoDB (Mongoose) + Tailwind CSS + jsPDF.

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
| `TEACHER_PASSWORD` | Öğretmen paneli (`/kadir-hancer-ozel`) şifresi |

### Sayfalar

- `/` — Öğrenci izin formu (giriş yok).
- `/kadir-hancer-ozel` — Öğretmen paneli (şifre korumalı). Günün bekleyen taleplerini listeler, toplu onay ve PDF üretimi sunar.

### PDF

`/public/signature.png` dosyasını kendi imzanızla değiştirin. PDF üretimi istemci tarafında
`jspdf` + `jspdf-autotable` ile yapılır.

## İş Akışı

1. Öğrenciler sabah formu doldurur → MongoDB'de `status: "beklemede"`.
2. Öğretmen panele girer, o günkü talepleri görür ve seçer.
3. "Onayla ve PDF Oluştur" ile dilekçe indirilir ve kayıtlar `status: "approved"` olur.
