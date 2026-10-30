import { describe, expect, it } from "vitest";
import { AXES } from "../src/data/axes";
import { QUESTIONS } from "../src/data/questions";
import { answerValue, scoreAnswers, typeCodes } from "../src/lib/scoring";

// 各問いで「pos 側に v だけ寄った」回答の生値を作る
const lean = (v: number, axis?: string) =>
  QUESTIONS.map((q) => (axis && q.axis !== axis ? 0 : q.reverse ? -v : v));

describe("questions", () => {
  it("has 5 questions per axis with 1-2 reversed", () => {
    expect(QUESTIONS).toHaveLength(20);
    for (const axis of AXES) {
      const qs = QUESTIONS.filter((q) => q.axis === axis.id);
      expect(qs).toHaveLength(5);
      const rev = qs.filter((q) => q.reverse).length;
      expect(rev).toBeGreaterThanOrEqual(1);
      expect(rev).toBeLessThanOrEqual(2);
    }
  });
});

describe("answerValue", () => {
  it("maps 5 choices to +2..-2", () => {
    expect([0, 1, 2, 3, 4].map((c) => answerValue(c as 0))).toEqual([2, 1, 0, -1, -2]);
  });
});

describe("scoreAnswers", () => {
  it("all pos -> SCGB, all neg -> WTVD", () => {
    expect(scoreAnswers(lean(2)).code).toBe("SCGB");
    expect(scoreAnswers(lean(-2)).code).toBe("WTVD");
    expect(scoreAnswers(lean(2)).scores).toEqual({ lead: 10, temp: 10, idea: 10, talk: 10 });
  });

  it("flips each axis independently", () => {
    const expected = { lead: "WCGB", temp: "STGB", idea: "SCVB", talk: "SCGD" };
    for (const axis of AXES) {
      const answers = lean(2).map((v, i) => (QUESTIONS[i].axis === axis.id ? -v : v));
      expect(scoreAnswers(answers).code).toBe(expected[axis.id]);
    }
  });

  it("breaks a tie with the last question of the axis", () => {
    const qs = QUESTIONS.map((q, i) => ({ q, i })).filter(({ q }) => q.axis === "lead");
    const answers = new Array(20).fill(0);
    // 先頭は neg 側に1、最後は pos 側に1 → 合計0、最後の問いで pos(S)
    const [first, last] = [qs[0], qs[qs.length - 1]];
    answers[first.i] = first.q.reverse ? 1 : -1;
    answers[last.i] = last.q.reverse ? -1 : 1;
    const r = scoreAnswers(answers);
    expect(r.scores.lead).toBe(0);
    expect(r.code[0]).toBe("S");
    // 逆にすると W
    answers[first.i] *= -1;
    answers[last.i] *= -1;
    expect(scoreAnswers(answers).code[0]).toBe("W");
  });

  it("all neutral -> SCGB", () => {
    expect(scoreAnswers(new Array(20).fill(0)).code).toBe("SCGB");
  });

  it("rejects wrong length", () => {
    expect(() => scoreAnswers([1, 2])).toThrow();
  });
});

describe("typeCodes", () => {
  it("lists 16 unique codes", () => {
    const codes = typeCodes();
    expect(codes).toHaveLength(16);
    expect(new Set(codes).size).toBe(16);
    expect(codes).toContain("STVB");
  });
});
