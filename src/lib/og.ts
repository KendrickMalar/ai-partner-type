import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import { AXES, sidesOf } from "../data/axes";
import { TYPES } from "../data/types";
import { robotColor, robotSvg } from "./robot";
import { SITE_NAME } from "./share";

// ビルド時はバンドル先に移るため、import.meta.url ではなくプロジェクトルートから辿る。
// 可変フォントは resvg で太さが効かないため、wght=700 で固定した静的フォントを使う
const FONT = join(process.cwd(), "src/fonts/NotoSansJP-Bold.ttf");
const FONT_FAMILY = "Noto Sans JP";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 読点の直後で折り返し、なければ文字数で切る（最大2行）
function wrap(text: string, max: number): string[] {
  const chars = [...text];
  if (chars.length <= max) return [text];
  const head = chars.slice(0, max).join("");
  const cut = head.lastIndexOf("、") + 1 || max;
  return [chars.slice(0, cut).join(""), chars.slice(cut).join("")];
}

// 1200x630 のシェア画像
export function ogSvg(code: string): string {
  const t = TYPES[code];
  const color = robotColor(code);
  const sides = sidesOf(code);
  const robot = robotSvg(code, 420).replace("<svg ", '<svg x="70" y="130" ');
  const chips = AXES.map((axis, i) => {
    const label = sides[i] ? axis.pos.label : axis.neg.label;
    const x = 560 + i * 140;
    return `<rect x="${x}" y="430" width="124" height="56" rx="28" fill="#fff" stroke="${color}" stroke-width="4"/>` +
      `<text x="${x + 62}" y="468" font-size="28" font-weight="700" text-anchor="middle" fill="#2b2d42">${label}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${FONT_FAMILY}">` +
    `<rect width="1200" height="630" fill="#fffaf3"/>` +
    `<rect x="0" y="0" width="1200" height="16" fill="${color}"/>` +
    `<circle cx="280" cy="340" r="230" fill="${color}" opacity="0.15"/>` +
    robot +
    `<text x="560" y="150" font-size="34" font-weight="700" fill="#6c6f80">あなたに合うAIパートナーは</text>` +
    `<text x="560" y="250" font-size="${Math.min(72, Math.floor(600 / [...t.name].length))}" font-weight="900" fill="#2b2d42">${escape(t.name)}</text>` +
    wrap(t.catch, 21).map((line, i) =>
      `<text x="560" y="${330 + i * 42}" font-size="28" font-weight="700" fill="#2b2d42">${escape(line)}</text>`).join("") +
    chips +
    `<text x="1140" y="580" font-size="28" font-weight="700" text-anchor="end" fill="${color}">${SITE_NAME}</text>` +
    `</svg>`;
}

export function renderPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: FONT_FAMILY },
  });
  return resvg.render().asPng();
}
