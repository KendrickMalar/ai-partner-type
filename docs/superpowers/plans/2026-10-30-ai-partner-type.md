# AIパートナータイプ診断 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 20問で16タイプのAIパートナー（ロボット）を出し、Xでシェアできる静的サイトを GitHub Pages に出す。

**Architecture:** Astro の静的出力。データ（軸・質問・タイプ）と純粋関数（採点・ロボットSVG・OG画像SVG）を `src/lib` / `src/data` に置き、Vitest で検証。OG PNG はビルド時に Astro エンドポイントで `@resvg/resvg-js` により生成。質問画面だけクライアントJS。

**Tech Stack:** Astro 7, TypeScript, Vitest 5, @resvg/resvg-js 2, Noto Sans JP（OFL、リポジトリに同梱）, GitHub Actions（withastro/action）

**Spec:** `docs/superpowers/specs/2026-10-30-ai-partner-type-design.md`

## Global Constraints

- `site: "https://kendrickmalar.github.io"`, `base: "/ai-partner-type"`。内部リンク・画像は必ず base 付き
- 日本語のみ。外部通信なし（解析なし、外部フォントCDNなし）
- 軸: 主導 S先回り/W待機、温度 C応援/T辛口、発想 G堅実/V冒険、話し方 B簡潔/D伴走。コードは4文字（例 `STVB`）
- 20問（1軸5問、各軸1〜2問は逆向き）。5段階 → +2〜-2
- 質問は「AIへの好み」を聞く。説明文は「このAIはあなたに〜する」。性格を決めつけない
- ラブタイプ診断の名前・絵・文章を写さない
- OG画像 1200×630 PNG、`og:image` は絶対URL、`twitter:card=summary_large_image`
- 回答は保存・送信しない

## Review Focus

- 同点（軸合計0）→ 必ずどちらかに決まる（その軸の最後の問いの回答で決め、それも0なら先頭側）。Task 1 にテスト
- 共有リンク（クエリなし）や不正クエリ（`?s=abc`）で結果ページを開く → バーはタイプ側を示すだけで壊れない。Task 4 で `parseScores` テスト
- 戻るボタンで1問目より前に戻ろうとする → 無効。途中リロード → 1問目から（保存しない）。Task 4 で手動確認
- base パス抜けで GitHub Pages 上だけリンク切れ → Task 5 でビルド出力の全 href/src を検査
- 長いキャラ名が OG 画像からはみ出す → 名前は12文字以内をテストで強制（Task 2）

---

## File Structure

```
astro.config.mjs, package.json, tsconfig.json, vitest.config.ts
src/data/axes.ts        軸定義
src/data/questions.ts   20問
src/data/types.ts       16タイプの文章
src/lib/scoring.ts      採点
src/lib/robot.ts        ロボットSVG文字列
src/lib/og.ts           OG用SVG文字列 → PNG
src/layouts/Base.astro  head/meta 共通
src/pages/index.astro, quiz.astro, types/index.astro, types/[code].astro, og/[code].png.ts
src/fonts/NotoSansJP.ttf
tests/*.test.ts
scripts/check-dist.mjs  ビルド出力検査
.github/workflows/deploy.yml
```

### Task 1: 雛形・軸・質問・採点

**Files:** Create 設定一式, `src/data/axes.ts`, `src/data/questions.ts`, `src/lib/scoring.ts`, `tests/scoring.test.ts`

**Interfaces (Produces):**
- `type AxisId = "lead" | "temp" | "idea" | "talk"`
- `AXES: { id: AxisId; name: string; pos: { letter: string; label: string; desc: string }; neg: {…} }[]`（順序 lead,temp,idea,talk。pos=S,C,G,B）
- `QUESTIONS: { id: number; axis: AxisId; text: string; reverse: boolean }[]`（20件、reverse=true なら「同意」が neg 側）
- `answerValue(choice: 0|1|2|3|4): number` → 0=あてはまる:+2 … 4:-2
- `scoreAnswers(answers: number[]): { code: string; scores: Record<AxisId, number> }`（answers は QUESTIONS 順の値 -2..2。scores は pos 側が正）
- `typeCodes(): string[]`（16件）

- [ ] Step 1: テスト: 全問+2→`SCGB`、全問-2→`WTVD`（reverse 考慮で生値を作る）、軸別に各側へ倒せる、同点時は最後の問いで決まる、全0→`SCGB`、`typeCodes().length===16`、各軸5問かつ reverse 1〜2問
- [ ] Step 2: `npx vitest run` → FAIL
- [ ] Step 3: 実装
- [ ] Step 4: PASS 確認
- [ ] Step 5: commit

### Task 2: 16タイプ文章とロボットSVG

**Files:** `src/data/types.ts`, `src/lib/robot.ts`, `tests/types.test.ts`, `tests/robot.test.ts`

**Interfaces:**
- `TYPES: Record<string, { code: string; name: string; catch: string; body: string[]; uses: string[]; color: string }>`（name ≤12文字・末尾「ボット」、body 2〜3段落、uses 3件）
- `robotSvg(code: string, size?: number): string` — 軸→部品: lead S=アンテナ+前のめり矢印/W=アンテナなし; temp C=暖色/T=寒色; idea G=四角頭/V=丸頭+星; talk B=一文字口/D=吹き出し
- [ ] テスト: 16コード全てに TYPES がある、名前一意・12文字以内、`robotSvg` が `<svg` で始まり、16種が全て異なる文字列
- [ ] 実装 → PASS → commit

### Task 3: OG画像

**Files:** `src/lib/og.ts`, `src/pages/og/[code].png.ts`, `src/fonts/NotoSansJP.ttf`, `tests/og.test.ts`
**Interfaces:** `ogSvg(code: string): string`（1200×630、ロボット・名前・catch・軸ラベル・サイト名）、`renderPng(svg: string): Buffer`（同梱フォント指定、システムフォント不使用）
- [ ] テスト: `renderPng(ogSvg("STVB"))` が PNG シグネチャで始まり幅1200×高630
- [ ] 実装 → PASS → commit

### Task 4: ページ

**Files:** `src/layouts/Base.astro`, `src/pages/*.astro`, `src/lib/share.ts`, `tests/share.test.ts`
**Interfaces:**
- `parseScores(search: string): Record<AxisId, number> | null`（`?s=10,-4,0,2` 形式、各 -10..10 の整数4つ以外は null）
- `shareUrl(code: string): string` → `https://x.com/intent/post?text=…&url=…`（本文「私に合うAIパートナーは『<名前>』でした」、ハッシュタグ `#AIパートナー診断`）
- 結果ページ: 上部に「診断をはじめる」、ロボット、名前、catch、軸バー（クエリなしならタイプ側に固定表示）、body、uses、シェア/再診断/一覧
- [ ] テスト: parseScores 正常・不正・範囲外、shareUrl の text/url エンコード
- [ ] 実装、`npm run build` 成功、`npm run preview` で手動確認（375px、戻る、最後で遷移）→ commit

### Task 5: 出力検査と公開ワークフロー

**Files:** `scripts/check-dist.mjs`, `.github/workflows/deploy.yml`, `README.md`
- [ ] `check-dist`: dist の全HTMLで内部 href/src が `/ai-partner-type/` 始まりで実在ファイルを指す、16結果ページに `og:image` 絶対URLと実在PNG、`twitter:card`
- [ ] `npm run build && node scripts/check-dist.mjs` → OK
- [ ] workflow（push main → withastro/action → deploy-pages）→ commit
- [ ] 公開（repo作成・push・Pages設定）はユーザー確認後
