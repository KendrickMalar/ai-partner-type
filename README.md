# AIパートナータイプ診断

20問のAIへの好みから、16体のロボットのうち「あなたに合うAIパートナー」を診断する静的サイトです。

公開URL: https://kendrickmalar.github.io/ai-partner-type/

## 開発

```sh
npm install
npm run dev         # 開発サーバー
npm test            # 採点・文章・OG画像・共有URLのテスト
npm run build       # dist/ に出力（OG画像もここで生成）
npm run check-dist  # リンクと OG メタの検査
```

- 質問: `src/data/questions.ts`、タイプの文章: `src/data/types.ts`、軸: `src/data/axes.ts`
- main に push すると GitHub Actions で GitHub Pages に公開されます（Settings → Pages の Source を「GitHub Actions」にする）

## ライセンス

フォント `src/fonts/NotoSansJP-Bold.ttf` は Noto Sans JP（SIL Open Font License 1.1、`src/fonts/OFL.txt`）を wght=700 で固定したものです。

## 戦場（3Dバトル）

- 結果ページの「戦闘に参加させる」から `/arena/` へ。部屋分けと ready は Cloudflare Worker（`worker/`、Durable Objects）が受け持つ
- 戦闘はサーバーが配る乱数の種から、各ブラウザが `src/lib/battle.ts` で同じ計算をして再生する
- 手元: `npx wrangler dev -c worker/wrangler.toml --port 8787` と `npm run dev`（`PUBLIC_ARENA_URL` 未設定なら `ws://127.0.0.1:8787/ws`）
- 公開: `npx wrangler deploy -c worker/wrangler.toml`
