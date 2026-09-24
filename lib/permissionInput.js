import { safeEqual } from "./auth.js";

const SUBE = ["A", "B", "C", "D"];

export const BULK_MAX = 50;

const digits = (v, max) => {
  const s = String(v ?? "").trim();
  return new RegExp(`^\\d{1,${max}}$`).test(s) ? Number(s) : null;
};

// Ogrenci formu ile toplu uc aynı kuralları paylaşır. Mesajlar formun mevcut
// mesajlarıyla aynı, böylece POST /api/permissions davranışı bozulmaz.
export function validatePermissionInput(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Geçersiz kayıt" };

  const adSoyad = typeof raw.adSoyad === "string" ? raw.adSoyad.trim() : "";
  const okulNo =
    typeof raw.okulNo === "string" || typeof raw.okulNo === "number" ? String(raw.okulNo).trim() : "";
  const sube = typeof raw.sube === "string" ? raw.sube.trim().toUpperCase() : "";
  const neden = typeof raw.neden === "string" ? raw.neden.trim() : "";
  const sinifRaw = String(raw.sinif ?? "").trim();
  const baslangicRaw = String(raw.baslangicDersi ?? "").trim();
  const bitisRaw = String(raw.bitisDersi ?? "").trim();

  if (!adSoyad || !okulNo || !sinifRaw || !sube || !baslangicRaw || !bitisRaw || !neden) {
    return { ok: false, error: "Tüm alanların doldurulması zorunludur." };
  }
  if (neden.length > 200) {
    return { ok: false, error: "Neden en fazla 200 karakter olabilir." };
  }

  const sinif = digits(sinifRaw, 2);
  if (sinif === null || sinif < 9 || sinif > 12) return { ok: false, error: "Geçersiz sınıf." };
  if (!SUBE.includes(sube)) return { ok: false, error: "Geçersiz şube." };

  const baslangicDersi = digits(baslangicRaw, 2);
  const bitisDersi = digits(bitisRaw, 2);
  if (
    baslangicDersi === null || bitisDersi === null ||
    baslangicDersi < 1 || baslangicDersi > 10 ||
    bitisDersi < 1 || bitisDersi > 10
  ) {
    return { ok: false, error: "Ders 1 ile 10 arasında tam sayı olmalı." };
  }
  if (bitisDersi < baslangicDersi) {
    return { ok: false, error: "Bitiş dersi başlangıç dersinden küçük olamaz." };
  }

  return {
    ok: true,
    value: { adSoyad, okulNo, sinif, sube, baslangicDersi, bitisDersi, neden },
  };
}

export function checkPermissionToken(authHeader) {
  const expected = process.env.PERMISSION_SYNC_TOKEN;
  if (!expected || expected.length < 16) return false;
  const match = /^Bearer (.+)$/.exec(authHeader || "");
  return match ? safeEqual(match[1], expected) : false;
}

export function validateBulkBody(body) {
  const items = body && typeof body === "object" ? body.items : null;
  if (!Array.isArray(items) || items.length === 0 || items.length > BULK_MAX) {
    return { ok: false, error: `items 1 ile ${BULK_MAX} arasında kayıt içermeli.` };
  }
  return { ok: true, items };
}

// DB'de mevcut talebi aramak için: doğrulamadan önce, ham kayıtlardan.
export function candidateOkulNos(items) {
  const out = [];
  for (const raw of items) {
    const v = raw && (typeof raw.okulNo === "string" || typeof raw.okulNo === "number")
      ? String(raw.okulNo).trim()
      : "";
    if (v) out.push(v);
  }
  return out;
}

// Saf: DB'siz. existingOkulNos bugün zaten talebi olanlar. Aynı istekteki
// tekrarlar da duplicate sayılır. Geçersiz kayıt okul no'yu tüketmez.
export function planBulk(items, existingOkulNos = new Set()) {
  const seen = new Set(existingOkulNos);
  const results = [];
  const toCreate = [];
  items.forEach((raw, index) => {
    const v = validatePermissionInput(raw);
    if (!v.ok) {
      const okulNo =
        raw && (typeof raw.okulNo === "string" || typeof raw.okulNo === "number")
          ? String(raw.okulNo).trim() || null
          : null;
      results.push({ index, okulNo, status: "invalid", error: v.error });
      return;
    }
    const { okulNo } = v.value;
    if (seen.has(okulNo)) {
      results.push({ index, okulNo, status: "duplicate" });
      return;
    }
    seen.add(okulNo);
    toCreate.push(v.value);
    results.push({ index, okulNo, status: "created" });
  });
  return { results, toCreate };
}
