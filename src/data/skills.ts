// 16体それぞれの必殺技（性格に根ざしたもの）。効果は battle.ts の kind ごとの処理で決まる
export type SkillKind =
  | "haste" | "heal" | "multi" | "blast" | "stunHit" | "mark" | "smash" | "swap"
  | "shield" | "hush" | "cheer" | "reflect" | "sharpen" | "percent" | "warp" | "weaken";

export interface Skill {
  name: string;
  desc: string;
  kind: SkillKind;
  cd: number; // 秒（シミュレーション時間）
}

export const SKILLS: Record<string, Skill> = {
  SCGB: { name: "段取り完璧", desc: "先回りで準備を整え、5秒間 攻撃の速さが2.5倍", kind: "haste", cd: 9 },
  SCGD: { name: "やさしい補習", desc: "自分をていねいに手当てして、HPを12%回復", kind: "heal", cd: 13 },
  SCVB: { name: "それいいね連打", desc: "ノリで3連続攻撃", kind: "multi", cd: 8 },
  SCVD: { name: "夢の大風呂敷", desc: "まわりの敵すべてを、大きな夢で巻きこむ範囲攻撃", kind: "blast", cd: 10 },
  STGB: { name: "千本ノック", desc: "強打で相手を1.5秒しびれさせる", kind: "stunHit", cd: 9 },
  STGD: { name: "赤ペン添削", desc: "一撃とともに弱点に印をつけ、5秒間 受けるダメージ1.4倍", kind: "mark", cd: 9 },
  STVB: { name: "全ボツ宣告", desc: "ありきたりを許さない、2.6倍の一撃", kind: "smash", cd: 9 },
  STVD: { name: "前提くずし", desc: "相手のほうがHPの割合がずっと高ければ、互いのHPの割合を入れ替える", kind: "swap", cd: 16 },
  WCGB: { name: "完璧な給仕", desc: "4秒間 受けるダメージを60%カット", kind: "shield", cd: 10 },
  WCGD: { name: "館内ではお静かに", desc: "まわりの敵を1.8秒 だまらせ、少しダメージ", kind: "hush", cd: 11 },
  WCVB: { name: "フレーフレー", desc: "自分を応援してHP6%回復、2秒間 速くなる", kind: "cheer", cd: 12 },
  WCVD: { name: "じっくり傾聴", desc: "5秒間 受けたダメージの8割を相手に返す", kind: "reflect", cd: 10 },
  WTGB: { name: "黙って研ぐ", desc: "攻撃力が10%ずつ上がる（3回まで）。そのあとは鋭い一撃", kind: "sharpen", cd: 8 },
  WTGD: { name: "査読リジェクト", desc: "相手の最大HPの15%を、冷静にけずる", kind: "percent", cd: 10 },
  WTVB: { name: "謎の新発明", desc: "HPが40%を切った敵に、遠くから発明品を飛ばして2.2倍のとどめ", kind: "warp", cd: 10 },
  WTVD: { name: "辛辣レビュー", desc: "まわりの敵の攻撃力を5秒間 30%下げる", kind: "weaken", cd: 10 },
};
