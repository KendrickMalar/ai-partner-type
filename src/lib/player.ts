// このブラウザの中だけに保存するプレイヤー名
const KEY = "apt:name";
export const NAME_MAX = 12;

export function loadName(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(KEY, [...name.trim()].slice(0, NAME_MAX).join(""));
  } catch {
    // 保存できなくても続ける
  }
}
