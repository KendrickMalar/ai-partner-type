import { AXES } from "../data/axes";
import { TYPES } from "../data/types";
import type { Scores } from "./scoring";

export const SITE_NAME = "AIパートナータイプ診断";
export const SITE_URL = "https://kendrickmalar.github.io/ai-partner-type/";
export const HASHTAG = "AIパートナー診断";

// 軸の点数を AXES 順のカンマ区切りにする（結果ページのクエリ用）
export function formatScores(scores: Scores): string {
  return AXES.map((a) => scores[a.id]).join(",");
}

// "?s=10,-4,0,2" を読む。形が違えば null（共有リンクから来た人はクエリなし）
export function parseScores(search: string): Scores | null {
  const raw = new URLSearchParams(search).get("s");
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== AXES.length) return null;
  const nums = parts.map((p) => (/^-?\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n < -10 || n > 10)) return null;
  return Object.fromEntries(AXES.map((a, i) => [a.id, nums[i]])) as Scores;
}

export function resultUrl(code: string): string {
  return `${SITE_URL}types/${code}/`;
}

export function shareUrl(code: string): string {
  const params = new URLSearchParams({
    text: `私に合うAIパートナーは『${TYPES[code].name}』でした`,
    url: resultUrl(code),
    hashtags: HASHTAG,
  });
  return `https://x.com/intent/post?${params}`;
}
