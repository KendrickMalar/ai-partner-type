import { sidesOf } from "../data/axes";

const INK = "#2b2d42";

// 温度（暖色/寒色）と発想で色を決める
export function robotColor(code: string): string {
  const [, cheer, steady] = sidesOf(code);
  if (cheer) return steady ? "#f4a261" : "#ef6f9a";
  return steady ? "#3d7dd8" : "#7a5cd6";
}

// 軸ごとに部品を対応させる:
// 主導=アンテナ/ボルト、温度=目と頬、発想=四角頭/丸頭+星、話し方=口/吹き出し
export function robotSvg(code: string, size = 200): string {
  const [ahead, cheer, steady, brief] = sidesOf(code);
  const color = robotColor(code);
  const parts: string[] = [];

  // 胴体
  parts.push(`<rect x="60" y="138" width="80" height="50" rx="14" fill="${color}" stroke="${INK}" stroke-width="4"/>`);
  parts.push(`<circle cx="100" cy="163" r="8" fill="#fff" stroke="${INK}" stroke-width="3"/>`);

  // 主導
  if (ahead) {
    parts.push(`<line x1="100" y1="42" x2="112" y2="14" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
    parts.push(`<circle cx="113" cy="12" r="8" fill="#ffd166" stroke="${INK}" stroke-width="3"/>`);
  } else {
    parts.push(`<rect x="34" y="78" width="12" height="24" rx="4" fill="${color}" stroke="${INK}" stroke-width="3"/>`);
    parts.push(`<rect x="154" y="78" width="12" height="24" rx="4" fill="${color}" stroke="${INK}" stroke-width="3"/>`);
  }

  // 頭（発想）
  if (steady) {
    parts.push(`<rect x="44" y="40" width="112" height="90" rx="14" fill="${color}" stroke="${INK}" stroke-width="4"/>`);
  } else {
    parts.push(`<ellipse cx="100" cy="86" rx="58" ry="48" fill="${color}" stroke="${INK}" stroke-width="4"/>`);
    parts.push(`<path d="M160 30 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" fill="#ffd166" stroke="${INK}" stroke-width="2"/>`);
  }
  // 顔のパネル
  parts.push(`<rect x="60" y="58" width="80" height="56" rx="12" fill="#fff" stroke="${INK}" stroke-width="3"/>`);

  // 目と頬（温度）
  if (cheer) {
    parts.push(`<path d="M72 82 q8 -10 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
    parts.push(`<path d="M112 82 q8 -10 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
    parts.push(`<circle cx="70" cy="98" r="6" fill="#ff8fa3" opacity="0.7"/>`);
    parts.push(`<circle cx="130" cy="98" r="6" fill="#ff8fa3" opacity="0.7"/>`);
  } else {
    parts.push(`<line x1="70" y1="70" x2="88" y2="75" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
    parts.push(`<line x1="130" y1="70" x2="112" y2="75" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
    parts.push(`<rect x="74" y="80" width="12" height="7" rx="2" fill="${INK}"/>`);
    parts.push(`<rect x="114" y="80" width="12" height="7" rx="2" fill="${INK}"/>`);
  }

  // 口（話し方）
  if (brief) {
    parts.push(`<line x1="90" y1="102" x2="110" y2="102" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
  } else {
    parts.push(`<ellipse cx="100" cy="102" rx="9" ry="6" fill="${INK}"/>`);
    parts.push(`<path d="M150 112 h38 a8 8 0 0 1 8 8 v16 a8 8 0 0 1 -8 8 h-26 l-10 9 v-9 h-2 a8 8 0 0 1 -8 -8 v-16 a8 8 0 0 1 8 -8 z" fill="#fff" stroke="${INK}" stroke-width="3"/>`);
    parts.push(`<circle cx="161" cy="128" r="3" fill="${INK}"/><circle cx="171" cy="128" r="3" fill="${INK}"/><circle cx="181" cy="128" r="3" fill="${INK}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img">${parts.join("")}</svg>`;
}
