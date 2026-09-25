import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

const TOKEN = "permission-token-0123456789";

beforeAll(() => {
  process.env.PERMISSION_SYNC_TOKEN = TOKEN;
});

const {
  BULK_MAX,
  validatePermissionInput,
  checkPermissionToken,
  validateBulkBody,
  candidateOkulNos,
  planBulk,
  PAST_MAX_DAYS,
  validatePastGun,
} = await import("./permissionInput.js");

const good = {
  adSoyad: " Ada Lovelace ",
  okulNo: "123",
  sinif: 10,
  sube: "b",
  baslangicDersi: 3,
  bitisDersi: 5,
  neden: " Atölye çalışması ",
};

describe("validatePermissionInput", () => {
  it("temizler, şubeyi büyütür, sayıları sayıya çevirir", () => {
    expect(validatePermissionInput(good)).toEqual({
      ok: true,
      value: {
        adSoyad: "Ada Lovelace",
        okulNo: "123",
        sinif: 10,
        sube: "B",
        baslangicDersi: 3,
        bitisDersi: 5,
        neden: "Atölye çalışması",
      },
    });
  });

  it("baştaki sıfırlı okul no metin olarak korunur", () => {
    const r = validatePermissionInput({ ...good, okulNo: "007" });
    expect(r.ok && r.value.okulNo).toBe("007");
  });

  it("metin olarak gelen sayıları kabul eder", () => {
    const r = validatePermissionInput({ ...good, sinif: "10", baslangicDersi: "3", bitisDersi: "5" });
    expect(r.ok && r.value.sinif).toBe(10);
  });

  it("eksik alanda mevcut formun mesajını verir", () => {
    expect(validatePermissionInput({ ...good, adSoyad: "" })).toEqual({
      ok: false,
      error: "Tüm alanların doldurulması zorunludur.",
    });
  });

  it("yalnız boşluk olan neden reddedilir", () => {
    expect(validatePermissionInput({ ...good, neden: "   " }).ok).toBe(false);
  });

  it("neden 200 karakteri geçerse reddedilir, tam 200 geçer", () => {
    expect(validatePermissionInput({ ...good, neden: "a".repeat(201) })).toEqual({
      ok: false,
      error: "Neden en fazla 200 karakter olabilir.",
    });
    expect(validatePermissionInput({ ...good, neden: "a".repeat(200) }).ok).toBe(true);
  });

  it("bitiş dersi başlangıçtan küçükse reddedilir", () => {
    expect(validatePermissionInput({ ...good, baslangicDersi: 5, bitisDersi: 3 })).toEqual({
      ok: false,
      error: "Bitiş dersi başlangıç dersinden küçük olamaz.",
    });
  });

  it.each([[3.5], ["abc"], [true], [0], [11], [-1], ["1e1"]])(
    "geçersiz ders %j reddedilir",
    (bad) => {
      expect(validatePermissionInput({ ...good, baslangicDersi: bad }).ok).toBe(false);
      expect(validatePermissionInput({ ...good, bitisDersi: bad }).ok).toBe(false);
    }
  );

  it.each([[8], [13], ["x"], [10.5]])("geçersiz sınıf %j reddedilir", (bad) => {
    expect(validatePermissionInput({ ...good, sinif: bad }).ok).toBe(false);
  });

  it.each([["E"], ["AB"], ["1"]])("geçersiz şube %j reddedilir", (bad) => {
    expect(validatePermissionInput({ ...good, sube: bad }).ok).toBe(false);
  });

  it("150 karakterlik ad kabul edilir", () => {
    // Öğrenci formunda maxLength yok ve model sınır koymuyor; eski davranış korunur.
    const r = validatePermissionInput({ ...good, adSoyad: "a".repeat(150) });
    expect(r.ok).toBe(true);
    expect(r.value.adSoyad).toHaveLength(150);
  });

  it.each([[null], [undefined], ["x"], [42]])("nesne olmayan %j reddedilir", (bad) => {
    expect(validatePermissionInput(bad).ok).toBe(false);
  });
});

describe("checkPermissionToken", () => {
  it("doğru Bearer token kabul edilir", () => {
    expect(checkPermissionToken(`Bearer ${TOKEN}`)).toBe(true);
  });
  it("yanlış, eksik ya da biçimsiz başlık reddedilir", () => {
    expect(checkPermissionToken("Bearer nope-nope-nope-nope")).toBe(false);
    expect(checkPermissionToken(TOKEN)).toBe(false);
    expect(checkPermissionToken(null)).toBe(false);
    expect(checkPermissionToken("")).toBe(false);
  });
  it("env yoksa ya da 16 karakterden kısaysa doğru token bile reddedilir", () => {
    const prev = process.env.PERMISSION_SYNC_TOKEN;
    process.env.PERMISSION_SYNC_TOKEN = "short";
    expect(checkPermissionToken("Bearer short")).toBe(false);
    delete process.env.PERMISSION_SYNC_TOKEN;
    expect(checkPermissionToken("Bearer short")).toBe(false);
    process.env.PERMISSION_SYNC_TOKEN = prev;
  });
});

describe("validateBulkBody", () => {
  it("items dizisi 1..BULK_MAX kabul edilir", () => {
    expect(validateBulkBody({ items: [good] })).toEqual({ ok: true, items: [good] });
    expect(validateBulkBody({ items: Array(BULK_MAX).fill(good) }).ok).toBe(true);
  });
  it("boş, fazla, dizi olmayan ya da gövdesiz istek reddedilir", () => {
    expect(validateBulkBody({ items: [] }).ok).toBe(false);
    expect(validateBulkBody({ items: Array(BULK_MAX + 1).fill(good) }).ok).toBe(false);
    expect(validateBulkBody({ items: "x" }).ok).toBe(false);
    expect(validateBulkBody(null).ok).toBe(false);
  });
});

describe("candidateOkulNos", () => {
  it("geçerli olsun olmasın okul no'ları kırpıp toplar, boşları atar", () => {
    expect(candidateOkulNos([{ okulNo: " 1 " }, { okulNo: 2 }, {}, null, { okulNo: "" }])).toEqual(["1", "2"]);
  });
});

describe("planBulk", () => {
  it("geçerli kaydı created işaretler ve toCreate'e koyar", () => {
    const { results, toCreate } = planBulk([good]);
    expect(results).toEqual([{ index: 0, okulNo: "123", status: "created" }]);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].sube).toBe("B");
  });

  it("bugün zaten talebi olan öğrenci duplicate olur, oluşturulmaz", () => {
    const { results, toCreate } = planBulk([good], new Set(["123"]));
    expect(results[0].status).toBe("duplicate");
    expect(toCreate).toHaveLength(0);
  });

  it("aynı istekte aynı okul no iki kez gelirse ikincisi duplicate olur", () => {
    const { results, toCreate } = planBulk([good, { ...good, neden: "başka" }]);
    expect(results.map((r) => r.status)).toEqual(["created", "duplicate"]);
    expect(toCreate).toHaveLength(1);
  });

  it("boşluk farkı olan aynı okul no aynı öğrencidir", () => {
    const { results } = planBulk([good, { ...good, okulNo: " 123 " }]);
    expect(results[1].status).toBe("duplicate");
  });

  it("geçersiz kayıt tek başına invalid olur, diğerleri etkilenmez", () => {
    const { results, toCreate } = planBulk([
      { ...good, okulNo: "1" },
      { ...good, okulNo: "2", baslangicDersi: 3.5 },
      { ...good, okulNo: "3" },
    ]);
    expect(results.map((r) => r.status)).toEqual(["created", "invalid", "created"]);
    expect(results[1].error).toBeTruthy();
    expect(toCreate.map((v) => v.okulNo)).toEqual(["1", "3"]);
  });

  it("okulNo'su olmayan geçersiz kayıt okulNo null döner", () => {
    const { results } = planBulk([{}]);
    expect(results[0]).toMatchObject({ index: 0, okulNo: null, status: "invalid" });
  });

  it("geçersiz kayıt okul no'yu tüketmez, sonraki geçerli kayıt created olur", () => {
    const { results } = planBulk([{ ...good, neden: "" }, good]);
    expect(results.map((r) => r.status)).toEqual(["invalid", "created"]);
  });
});

describe("validatePastGun", () => {
  const today = "2026-09-25";

  it("dünü ve bugünden önceki günleri kabul eder", () => {
    expect(validatePastGun("2026-09-24", today)).toEqual({ ok: true, gun: "2026-09-24" });
    expect(validatePastGun(" 2026-09-01 ", today)).toEqual({ ok: true, gun: "2026-09-01" });
  });

  it("bugünü reddeder, bugün normal form kullanılır", () => {
    expect(validatePastGun("2026-09-25", today).ok).toBe(false);
  });

  it("gelecek günü reddeder", () => {
    expect(validatePastGun("2026-09-26", today).ok).toBe(false);
  });

  it("tam PAST_MAX_DAYS gün öncesini kabul eder, bir gün fazlasını reddeder", () => {
    expect(PAST_MAX_DAYS).toBe(90);
    expect(validatePastGun("2026-06-27", today).ok).toBe(true);
    expect(validatePastGun("2026-06-26", today).ok).toBe(false);
  });

  it("bozuk biçimi reddeder", () => {
    for (const bad of ["", "2026-9-1", "25-09-2026", "2026/09/01", "yarın", null, undefined, 20260901]) {
      expect(validatePastGun(bad, today).ok).toBe(false);
    }
  });

  it("takvimde olmayan günü reddeder", () => {
    expect(validatePastGun("2026-02-30", today).ok).toBe(false);
    expect(validatePastGun("2026-13-01", today).ok).toBe(false);
    expect(validatePastGun("2026-04-31", today).ok).toBe(false);
  });

  it("hata mesajı verir", () => {
    const r = validatePastGun("2026-09-26", today);
    expect(typeof r.error).toBe("string");
    expect(r.error.length).toBeGreaterThan(0);
  });
});
