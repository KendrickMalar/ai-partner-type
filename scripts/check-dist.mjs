// ビルド出力の検査: base 付きの内部リンクが実在するか、結果ページの OG メタが正しいか
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const BASE = "/ai-partner-type/";
const SITE = "https://kendrickmalar.github.io";
const CODES = ["S", "W"].flatMap((a) => ["C", "T"].flatMap((b) => ["G", "V"].flatMap((c) => ["B", "D"].map((d) => a + b + c + d))));

const errors = [];
const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith(".html") ? [p] : [];
  });

// /ai-partner-type/xxx を dist 内のファイルに対応づける
const resolve = (url) => {
  const path = decodeURIComponent(url.split(/[?#]/)[0]).slice(BASE.length);
  const file = join(DIST, path);
  return path === "" || path.endsWith("/") ? join(file, "index.html") : file;
};

for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, "utf8");
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:|#)/.test(url)) continue;
    if (!url.startsWith(BASE)) errors.push(`${file}: base なしのリンク ${url}`);
    else if (!existsSync(resolve(url))) errors.push(`${file}: 存在しない ${url}`);
  }
}

for (const code of CODES) {
  const file = join(DIST, "types", code, "index.html");
  if (!existsSync(file)) {
    errors.push(`結果ページがない: ${code}`);
    continue;
  }
  const html = readFileSync(file, "utf8");
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const expected = `${SITE}${BASE}og/${code}.png`;
  if (image !== expected) errors.push(`${code}: og:image が ${image}（期待 ${expected}）`);
  if (!existsSync(join(DIST, "og", `${code}.png`))) errors.push(`${code}: PNG がない`);
  if (!html.includes('<meta name="twitter:card" content="summary_large_image"')) errors.push(`${code}: twitter:card がない`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${htmlFiles(DIST).length} HTML, ${CODES.length} result pages`);
