import { safeEqual } from "./auth.js";

const SUBE = ["A", "B", "C", "D"];

// Eğitim yılı 1 Eylül'de başlar (UTC ay indeksi 8 = Eylül).
export function schoolYearStart(date = new Date()) {
  return date.getUTCMonth() >= 8 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

// Kayıt anındaki sınıfı bugüne taşır. 9-12 dışı (mezun ya da geçersiz) null.
export function currentGrade(sinif, okulYili, now = new Date()) {
  const grade = sinif + (schoolYearStart(now) - okulYili);
  return grade >= 9 && grade <= 12 ? grade : null;
}

export function validateRosterEntry(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Geçersiz kayıt" };
  const adSoyad = typeof raw.adSoyad === "string" ? raw.adSoyad.trim() : "";
  const okulNo = typeof raw.okulNo === "string" ? raw.okulNo.trim() : "";
  const sinif = Number(raw.sinif);
  const sube = typeof raw.sube === "string" ? raw.sube.trim().toUpperCase() : "";
  const okulYili = Number(raw.okulYili);

  if (!adSoyad || adSoyad.length > 100) return { ok: false, error: "Geçersiz adSoyad" };
  if (!/^\d{1,10}$/.test(okulNo)) return { ok: false, error: "Geçersiz okulNo" };
  if (!Number.isInteger(sinif) || sinif < 9 || sinif > 12) return { ok: false, error: "Geçersiz sinif" };
  if (!SUBE.includes(sube)) return { ok: false, error: "Geçersiz sube" };
  if (!Number.isInteger(okulYili) || okulYili < 2000 || okulYili > 2100) {
    return { ok: false, error: "Geçersiz okulYili" };
  }
  return { ok: true, value: { adSoyad, okulNo, sinif, sube, okulYili } };
}

export function checkRosterToken(authHeader) {
  const expected = process.env.ROSTER_SYNC_TOKEN;
  if (!expected || expected.length < 16) return false;
  const match = /^Bearer (.+)$/.exec(authHeader || "");
  return match ? safeEqual(match[1], expected) : false;
}

// Permission (öğrencinin son girdiği veri) önce gelir, Roster yalnızca izin
// geçmişi olmayanlar için yedek. Aynı okulNo bir kez döner.
export function mergeStudents(permissionRows, rosterRows, now = new Date(), limit = 8) {
  const seen = new Set();
  const out = [];
  for (const p of permissionRows) {
    if (seen.has(p.okulNo)) continue;
    seen.add(p.okulNo);
    out.push({ adSoyad: p.adSoyad, okulNo: p.okulNo, sinif: p.sinif, sube: p.sube });
  }
  for (const r of rosterRows) {
    if (seen.has(r.okulNo)) continue;
    const sinif = currentGrade(r.sinif, r.okulYili, now);
    if (sinif === null) continue;
    seen.add(r.okulNo);
    out.push({ adSoyad: r.adSoyad, okulNo: r.okulNo, sinif, sube: r.sube });
  }
  return out.slice(0, limit);
}
