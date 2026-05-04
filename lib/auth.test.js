import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    set: () => {},
  }),
}));

const HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeAll(() => {
  process.env.SESSION_SECRET = HEX;
  process.env.TEACHER_PASSWORD = "teacher-pass";
});

const auth = await import("./auth.js");
const {
  _signForTest,
  _verifyForTest,
  isSameOrigin,
  escapeRegex,
  safeEqual,
  checkTeacherPassword,
  checkAdminPassword,
} = auth;

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

describe("session token", () => {
  it("round-trips a valid teacher token", () => {
    const t = _signForTest("teacher", 60);
    expect(_verifyForTest(t, "teacher")).toBe(true);
  });

  it("rejects wrong role", () => {
    const t = _signForTest("teacher", 60);
    expect(_verifyForTest(t, "admin")).toBe(false);
  });

  it("rejects payload swap with original signature", () => {
    const t = _signForTest("teacher", 60);
    const [, sig] = t.split(".");
    const fake = b64url({ role: "admin", iat: 0, exp: 9999999999 });
    expect(_verifyForTest(`${fake}.${sig}`, "admin")).toBe(false);
  });

  it("rejects bad signature", () => {
    const t = _signForTest("teacher", 60);
    const [payload] = t.split(".");
    expect(_verifyForTest(`${payload}.AAAA`, "teacher")).toBe(false);
  });

  it("rejects expired token", () => {
    const t = _signForTest("teacher", -1);
    expect(_verifyForTest(t, "teacher")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(_verifyForTest("notatoken", "teacher")).toBe(false);
    expect(_verifyForTest("", "teacher")).toBe(false);
    expect(_verifyForTest(null, "teacher")).toBe(false);
  });

  it("throws when SESSION_SECRET is missing", () => {
    const orig = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "";
    try {
      expect(() => _signForTest("teacher", 60)).toThrow();
    } finally {
      process.env.SESSION_SECRET = orig;
    }
  });
});

describe("isSameOrigin", () => {
  const req = (h) => ({
    headers: { get: (k) => h[k.toLowerCase()] ?? null },
  });

  it("allows when no origin header", () => {
    expect(isSameOrigin(req({ host: "izinsistemi.vercel.app" }))).toBe(true);
  });

  it("allows matching host", () => {
    expect(
      isSameOrigin(
        req({
          origin: "https://izinsistemi.vercel.app",
          host: "izinsistemi.vercel.app",
        })
      )
    ).toBe(true);
  });

  it("rejects mismatched origin", () => {
    expect(
      isSameOrigin(
        req({
          origin: "https://evil.example",
          host: "izinsistemi.vercel.app",
        })
      )
    ).toBe(false);
  });

  it("rejects when origin set but host missing", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
  });
});

describe("password helpers", () => {
  it("safeEqual is constant-time true for equal", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });
  it("safeEqual rejects different content and lengths", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("safeEqual rejects non-strings", () => {
    expect(safeEqual(null, "x")).toBe(false);
    expect(safeEqual("x", undefined)).toBe(false);
    expect(safeEqual(1, 1)).toBe(false);
  });
  it("checkTeacherPassword returns false when env empty", () => {
    const orig = process.env.TEACHER_PASSWORD;
    process.env.TEACHER_PASSWORD = "";
    try {
      expect(checkTeacherPassword("anything")).toBe(false);
    } finally {
      process.env.TEACHER_PASSWORD = orig;
    }
  });
  it("checkAdminPassword falls back to teacher when admin unset", () => {
    const ot = process.env.TEACHER_PASSWORD;
    const oa = process.env.ADMIN_PASSWORD;
    process.env.TEACHER_PASSWORD = "TX";
    process.env.ADMIN_PASSWORD = "";
    try {
      expect(checkAdminPassword("TX")).toBe(true);
      expect(checkAdminPassword("wrong")).toBe(false);
    } finally {
      process.env.TEACHER_PASSWORD = ot;
      process.env.ADMIN_PASSWORD = oa;
    }
  });
  it("checkAdminPassword uses dedicated admin password when set", () => {
    const oa = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "ADMIN-Z";
    try {
      expect(checkAdminPassword("ADMIN-Z")).toBe(true);
      expect(checkAdminPassword(process.env.TEACHER_PASSWORD)).toBe(false);
    } finally {
      process.env.ADMIN_PASSWORD = oa;
    }
  });
});

describe("escapeRegex", () => {
  it("escapes regex metachars", () => {
    expect(escapeRegex("a.b*c?")).toBe("a\\.b\\*c\\?");
  });
  it("leaves plain text alone", () => {
    expect(escapeRegex("Ahmet Yılmaz")).toBe("Ahmet Yılmaz");
  });
});
