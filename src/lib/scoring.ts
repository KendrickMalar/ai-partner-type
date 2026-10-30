import { AXES, type AxisId } from "../data/axes";
import { QUESTIONS } from "../data/questions";

export type Scores = Record<AxisId, number>;

// 選択肢の番号（0=あてはまる … 4=あてはまらない）を +2..-2 に換算する
export function answerValue(choice: 0 | 1 | 2 | 3 | 4): number {
  return 2 - choice;
}

// answers は QUESTIONS 順の生値（-2..2）。scores は pos 側が正
export function scoreAnswers(answers: number[]): { code: string; scores: Scores } {
  if (answers.length !== QUESTIONS.length) {
    throw new Error(`expected ${QUESTIONS.length} answers, got ${answers.length}`);
  }
  const scores = { lead: 0, temp: 0, idea: 0, talk: 0 } as Scores;
  // 同点時に使う、軸ごとの最後の問いの寄り
  const last = { lead: 0, temp: 0, idea: 0, talk: 0 } as Scores;
  QUESTIONS.forEach((q, i) => {
    const v = q.reverse ? -answers[i] : answers[i];
    scores[q.axis] += v;
    last[q.axis] = v;
  });
  const code = AXES.map((axis) => {
    const s = scores[axis.id] || last[axis.id];
    return s >= 0 ? axis.pos.letter : axis.neg.letter;
  }).join("");
  return { code, scores };
}

export function typeCodes(): string[] {
  return AXES.reduce<string[]>(
    (codes, axis) => codes.flatMap((c) => [c + axis.pos.letter, c + axis.neg.letter]),
    [""],
  );
}
