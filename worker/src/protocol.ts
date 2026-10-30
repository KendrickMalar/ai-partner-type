// ブラウザとサーバーのあいだでやりとりするメッセージ（両方から import する）

export const MAX_PLAYERS = 8;
export const COUNTDOWN_MS = 30_000;
export const START_DELAY_MS = 3_000;
export const NAME_MAX = 12;

export interface LobbyPlayer {
  id: string;
  name: string;
  code: string;
  ready: boolean;
}

export type ClientMessage =
  | { type: "join"; code: string; name: string }
  | { type: "ready" };

export type ServerMessage =
  | { type: "welcome"; id: string; room: string }
  | { type: "lobby"; players: LobbyPlayer[]; countdownEnd: number | null; now: number }
  | { type: "start"; seed: number; entrants: { id: string; name: string; code: string }[]; startAt: number; now: number }
  | { type: "error"; message: string };

const CODE_RE = /^[SW][CT][GV][BD]$/;

export function isTypeCode(code: unknown): code is string {
  return typeof code === "string" && CODE_RE.test(code);
}

// 制御文字を消し、前後の空白を落とし、12文字（コードポイント）までにする
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const stripped = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, "").trim();
  return [...stripped].slice(0, NAME_MAX).join("");
}
