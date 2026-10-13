import { describe, expect, test } from "bun:test";
import { applyPattern, resolveSaveName, sanitizeFileName, sanitizeSaveName } from "./naming";

describe("applyPattern", () => {
  test("default-style pattern substitutes {name}", () => {
    expect(applyPattern("{name}-RTO", { name: "inv-101", seq: 1, date: "2026-10-13" })).toBe("inv-101-RTO");
  });

  test("substitutes {date} and {seq}", () => {
    expect(applyPattern("{date} invoice {seq}", { name: "inv-101", seq: 3, date: "2026-10-13" })).toBe(
      "2026-10-13 invoice 3",
    );
  });

  test("unknown placeholders are left as literal text", () => {
    expect(applyPattern("{vehicle}-{name}", { name: "inv-101", seq: 1, date: "2026-10-13" })).toBe(
      "{vehicle}-inv-101",
    );
  });

  test("repeated placeholders are all substituted", () => {
    expect(applyPattern("{name}/{name}", { name: "a", seq: 1, date: "d" })).toBe("a/a");
  });
});

describe("sanitizeFileName", () => {
  test("keeps a clean name", () => {
    expect(sanitizeFileName("inv-101-RTO.pdf")).toBe("inv-101-RTO.pdf");
  });

  test("replaces characters illegal in Windows file names", () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j.pdf')).toBe("a_b_c_d_e_f_g_h_i_j.pdf");
  });

  test("appends .pdf when the extension is missing", () => {
    expect(sanitizeFileName("inv-101-RTO")).toBe("inv-101-RTO.pdf");
  });

  test("falls back to a safe name when nothing usable remains", () => {
    expect(sanitizeFileName("///")).toBe("invoice.pdf");
  });
});

describe("sanitizeSaveName", () => {
  test("uses a non-blank override, sanitised", () => {
    expect(sanitizeSaveName("my:invoice", "fallback-RTO")).toBe("my_invoice.pdf");
  });

  test("falls back when the override is missing or blank", () => {
    expect(sanitizeSaveName(undefined, "fallback-RTO")).toBe("fallback-RTO.pdf");
    expect(sanitizeSaveName("   ", "fallback-RTO")).toBe("fallback-RTO.pdf");
  });
});

describe("resolveSaveName", () => {
  test("applies the pattern and sanitises in one step", () => {
    expect(resolveSaveName("{name}-RTO", { name: "bad:name", seq: 1, date: "2026-10-13" })).toBe(
      "bad_name-RTO.pdf",
    );
  });
});
