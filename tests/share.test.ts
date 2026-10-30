import { describe, expect, it } from "vitest";
import { formatScores, parseScores, resultUrl, shareUrl } from "../src/lib/share";

describe("parseScores", () => {
  it("parses four integers in range", () => {
    expect(parseScores("?s=10,-4,0,2")).toEqual({ lead: 10, temp: -4, idea: 0, talk: 2 });
  });

  it("returns null for missing or broken input", () => {
    for (const q of ["", "?s=", "?s=abc", "?s=1,2,3", "?s=1,2,3,4,5", "?s=11,0,0,0", "?s=1.5,0,0,0", "?x=1,2,3,4"]) {
      expect(parseScores(q)).toBeNull();
    }
  });

  it("round-trips with formatScores", () => {
    const s = { lead: -10, temp: 3, idea: 0, talk: 7 };
    expect(parseScores("?s=" + formatScores(s))).toEqual(s);
  });
});

describe("urls", () => {
  it("builds result url with base path", () => {
    expect(resultUrl("STVB")).toBe("https://kendrickmalar.github.io/ai-partner-type/types/STVB/");
  });

  it("builds an X intent with name, url and hashtag", () => {
    const u = new URL(shareUrl("STVB"));
    expect(u.origin + u.pathname).toBe("https://x.com/intent/post");
    expect(u.searchParams.get("text")).toBe("私に合うAIパートナーは『毒舌アイデアマンボット』でした");
    expect(u.searchParams.get("url")).toBe("https://kendrickmalar.github.io/ai-partner-type/types/STVB/");
    expect(u.searchParams.get("hashtags")).toBe("AIパートナー診断");
  });
});
