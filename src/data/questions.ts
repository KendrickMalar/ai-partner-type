import type { AxisId } from "./axes";

export interface Question {
  id: number;
  axis: AxisId;
  text: string;
  // true なら「あてはまる」が neg 側に寄る
  reverse: boolean;
}

export const QUESTIONS: Question[] = [
  { id: 1, axis: "lead", text: "頼んでいないことでも、気づいたことは先に提案してほしい", reverse: false },
  { id: 2, axis: "temp", text: "まずは良いところをほめてから、直す点を言ってほしい", reverse: false },
  { id: 3, axis: "idea", text: "答えには、根拠や出典を添えてほしい", reverse: false },
  { id: 4, axis: "talk", text: "前置きはいらないので、結論から言ってほしい", reverse: false },
  { id: 5, axis: "lead", text: "指示したこと以外には、手を出さないでほしい", reverse: true },
  { id: 6, axis: "temp", text: "遠慮はいらないので、ダメなところははっきり言ってほしい", reverse: true },
  { id: 7, axis: "idea", text: "突拍子もないアイデアを、どんどん出してほしい", reverse: true },
  { id: 8, axis: "talk", text: "なぜその答えになったのか、考えた道筋も知りたい", reverse: true },
  { id: 9, axis: "lead", text: "AIには、次にやるべきことまで示してほしい", reverse: false },
  { id: 10, axis: "temp", text: "疲れているときは、正論より励ましがほしい", reverse: false },
  { id: 11, axis: "idea", text: "「たぶん」で答えるくらいなら、「わからない」と言ってほしい", reverse: false },
  { id: 12, axis: "talk", text: "答えは箇条書き3行くらいで十分だ", reverse: false },
  { id: 13, axis: "lead", text: "質問の意図をくみ取って、聞いていない関連情報も足してほしい", reverse: false },
  { id: 14, axis: "temp", text: "AIにお世辞を言われると、かえって信用できなくなる", reverse: true },
  { id: 15, axis: "idea", text: "確実さより、ワクワクする意外な案のほうがうれしい", reverse: true },
  { id: 16, axis: "talk", text: "一緒に考えているような、会話のやりとりを楽しみたい", reverse: true },
  { id: 17, axis: "lead", text: "迷ったときは、AIのほうから「こうしませんか」と言ってほしい", reverse: false },
  { id: 18, axis: "temp", text: "アイデアを見せたら、まず「いいですね」と受け止めてほしい", reverse: false },
  { id: 19, axis: "idea", text: "実績のある定番のやり方を勧めてほしい", reverse: false },
  { id: 20, axis: "talk", text: "長い説明は、つい読み飛ばしてしまう", reverse: false },
];

export const CHOICES = ["あてはまる", "ややあてはまる", "どちらでもない", "ややあてはまらない", "あてはまらない"];
