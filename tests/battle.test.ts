import { describe, expect, it } from "vitest";
import { Battle, type Entrant } from "../src/lib/battle";
import { typeCodes } from "../src/lib/scoring";

const entrants = (codes: string[]): Entrant[] => codes.map((code, i) => ({ id: `p${i}`, name: `n${i}`, code }));

describe("Battle", () => {
  it("is deterministic for the same seed regardless of entrant order", () => {
    const es = entrants(["STVB", "WCGD", "SCVD", "WTGB"]);
    const a = new Battle(es, 42).run();
    const b = new Battle([...es].reverse(), 42).run();
    expect(a).toEqual(b);
  });

  it("ends with one winner and unique places within 3 minutes for 2..8 players", () => {
    const codes = typeCodes();
    for (let n = 2; n <= 8; n++) {
      for (let seed = 1; seed <= 20; seed++) {
        const es = entrants(Array.from({ length: n }, (_, i) => codes[(i * 5 + seed) % 16]));
        const r = new Battle(es, seed).run();
        expect(r.time).toBeLessThanOrEqual(180);
        const places = Object.values(r.places).sort((x, y) => x - y);
        expect(places).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(r.places[r.winner]).toBe(1);
      }
    }
  });

  it("gives every type a reasonable chance in 8-player games", () => {
    const codes = typeCodes();
    const wins: Record<string, number> = Object.fromEntries(codes.map((c) => [c, 0]));
    const games: Record<string, number> = Object.fromEntries(codes.map((c) => [c, 0]));
    const r = (s: number) => ((s * 2654435761) >>> 0) % 16;
    for (let seed = 1; seed <= 1500; seed++) {
      const picked = Array.from({ length: 8 }, (_, i) => codes[r(seed * 8 + i)]);
      const es = entrants(picked);
      const res = new Battle(es, seed).run();
      picked.forEach((c) => games[c]++);
      wins[es.find((e) => e.id === res.winner)!.code]++;
    }
    for (const c of codes) {
      const rate = wins[c] / games[c];
      // 基準 12.5%。発表用の大まかな歯止め
      expect(rate, c).toBeGreaterThan(0.04);
      expect(rate, c).toBeLessThan(0.3);
    }
  });
});
