import { describe, expect, it } from "vitest";
import { ogSvg, renderPng } from "../src/lib/og";

describe("og image", () => {
  it("renders a 1200x630 png", () => {
    const png = renderPng(ogSvg("STVB"));
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it("contains the type name", () => {
    expect(ogSvg("WTGB")).toContain("無口な職人ボット");
  });
});
