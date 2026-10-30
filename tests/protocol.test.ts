import { describe, expect, it } from "vitest";
import { cleanName, isTypeCode } from "../worker/src/protocol";

describe("protocol", () => {
  it("accepts only valid type codes", () => {
    expect(isTypeCode("STVB")).toBe(true);
    for (const bad of ["stvb", "SSVB", "STV", "STVBX", 1, null]) expect(isTypeCode(bad)).toBe(false);
  });

  it("cleans names", () => {
    expect(cleanName("  くの  ")).toBe("くの");
    expect(cleanName("a\u0000b‮c")).toBe("abc");
    expect(cleanName("一二三四五六七八九十壱弐参")).toBe("一二三四五六七八九十壱弐");
    expect(cleanName("😀".repeat(20))).toBe("😀".repeat(12));
    expect(cleanName(42)).toBe("");
  });
});
