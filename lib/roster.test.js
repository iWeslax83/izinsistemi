import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const TOKEN = "roster-token-0123456789";

beforeAll(() => {
  process.env.ROSTER_SYNC_TOKEN = TOKEN;
});

const {
  schoolYearStart,
  currentGrade,
  validateRosterEntry,
  checkRosterToken,
  mergeStudents,
} = await import("./roster.js");

describe("schoolYearStart", () => {
  it("Eylül ve sonrası o yıl", () => {
    expect(schoolYearStart(new Date("2026-09-01T12:00:00Z"))).toBe(2026);
    expect(schoolYearStart(new Date("2026-12-31T12:00:00Z"))).toBe(2026);
  });
  it("Ağustos ve öncesi bir önceki yıl", () => {
    expect(schoolYearStart(new Date("2026-08-31T12:00:00Z"))).toBe(2025);
    expect(schoolYearStart(new Date("2027-01-15T12:00:00Z"))).toBe(2026);
  });
});

describe("currentGrade", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  it("aynı yıl sınıf değişmez", () => {
    expect(currentGrade(10, 2026, now)).toBe(10);
  });
  it("her Eylül bir artar", () => {
    expect(currentGrade(9, 2025, now)).toBe(10);
    expect(currentGrade(11, 2025, now)).toBe(12);
  });
  it("12'yi geçen mezun sayılır", () => {
    expect(currentGrade(12, 2025, now)).toBeNull();
  });
  it("gelecekteki okul yılı geçersiz", () => {
    expect(currentGrade(9, 2027, now)).toBeNull();
  });
});

describe("validateRosterEntry", () => {
  const good = { adSoyad: " Ada Lovelace ", okulNo: "123", sinif: 10, sube: "b", okulYili: 2026 };
  it("temizler ve kabul eder", () => {
    expect(validateRosterEntry(good)).toEqual({
      ok: true,
      value: { adSoyad: "Ada Lovelace", okulNo: "123", sinif: 10, sube: "B", okulYili: 2026 },
    });
  });
  it.each([
    [{ ...good, adSoyad: "" }],
    [{ ...good, okulNo: "12a" }],
    [{ ...good, sinif: 8 }],
    [{ ...good, sinif: 13 }],
    [{ ...good, sube: "E" }],
    [{ ...good, okulYili: 1999 }],
    [null],
    ["x"],
  ])("reddeder: %j", (bad) => {
    expect(validateRosterEntry(bad).ok).toBe(false);
  });
});

describe("checkRosterToken", () => {
  it("doğru Bearer token geçer", () => {
    expect(checkRosterToken(`Bearer ${TOKEN}`)).toBe(true);
  });
  it("yanlış, eksik ya da biçimsiz header reddedilir", () => {
    expect(checkRosterToken("Bearer wrong-token-0123456789")).toBe(false);
    expect(checkRosterToken(TOKEN)).toBe(false);
    expect(checkRosterToken(null)).toBe(false);
  });
  it("env tanımsız ya da kısa ise fail-closed", () => {
    const prev = process.env.ROSTER_SYNC_TOKEN;
    process.env.ROSTER_SYNC_TOKEN = "short";
    expect(checkRosterToken("Bearer short")).toBe(false);
    delete process.env.ROSTER_SYNC_TOKEN;
    expect(checkRosterToken(`Bearer ${TOKEN}`)).toBe(false);
    process.env.ROSTER_SYNC_TOKEN = prev;
  });
});

describe("mergeStudents", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  const perm = [{ adSoyad: "Ali Veli", okulNo: "1", sinif: 11, sube: "A" }];

  it("çakışmada Permission kazanır", () => {
    const roster = [{ adSoyad: "Ali Veli", okulNo: "1", sinif: 9, sube: "C", okulYili: 2025 }];
    expect(mergeStudents(perm, roster, now)).toEqual(perm);
  });
  it("Roster'ı güncel sınıfla ekler", () => {
    const roster = [{ adSoyad: "Ayşe Kaya", okulNo: "2", sinif: 9, sube: "B", okulYili: 2025 }];
    expect(mergeStudents([], roster, now)).toEqual([
      { adSoyad: "Ayşe Kaya", okulNo: "2", sinif: 10, sube: "B" },
    ]);
  });
  it("mezun Roster kaydını düşürür", () => {
    const roster = [{ adSoyad: "Eski Mezun", okulNo: "3", sinif: 12, sube: "A", okulYili: 2025 }];
    expect(mergeStudents([], roster, now)).toEqual([]);
  });
  it("limiti uygular", () => {
    const roster = Array.from({ length: 12 }, (_, i) => ({
      adSoyad: `Öğrenci ${i}`, okulNo: String(100 + i), sinif: 10, sube: "A", okulYili: 2026,
    }));
    expect(mergeStudents([], roster, now, 8)).toHaveLength(8);
  });
});
