import { describe, expect, it } from "vitest";
import { TYPES } from "../src/data/types";
import { robotColor, robotSvg } from "../src/lib/robot";
import { typeCodes } from "../src/lib/scoring";

describe("TYPES", () => {
  it("covers all 16 codes with valid copy", () => {
    const codes = typeCodes();
    expect(Object.keys(TYPES).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      const t = TYPES[code];
      expect(t.code).toBe(code);
      expect([...t.name].length).toBeLessThanOrEqual(12);
      expect(t.name.endsWith("ボット")).toBe(true);
      expect(t.catch.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThanOrEqual(2);
      expect(t.body.length).toBeLessThanOrEqual(3);
      expect(t.uses).toHaveLength(3);
    }
  });

  it("has unique names", () => {
    const names = Object.values(TYPES).map((t) => t.name);
    expect(new Set(names).size).toBe(16);
  });
});

describe("robotSvg", () => {
  it("draws 16 distinct svgs", () => {
    const svgs = typeCodes().map((c) => robotSvg(c));
    for (const s of svgs) expect(s.startsWith("<svg")).toBe(true);
    expect(new Set(svgs).size).toBe(16);
  });

  it("uses warm color for C and cool for T", () => {
    expect(robotColor("SCGB")).not.toBe(robotColor("STGB"));
    expect(robotColor("SCGB")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
