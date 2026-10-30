export type AxisId = "lead" | "temp" | "idea" | "talk";

export interface AxisSide {
  letter: string;
  label: string;
  desc: string;
}

export interface Axis {
  id: AxisId;
  name: string;
  pos: AxisSide;
  neg: AxisSide;
}

// 順序はタイプコードの文字順と一致させる
export const AXES: Axis[] = [
  {
    id: "lead",
    name: "主導",
    pos: { letter: "S", label: "先回り", desc: "頼む前に提案してくる" },
    neg: { letter: "W", label: "待機", desc: "頼まれたことを正確にこなす" },
  },
  {
    id: "temp",
    name: "温度",
    pos: { letter: "C", label: "応援", desc: "まずほめて、背中を押す" },
    neg: { letter: "T", label: "辛口", desc: "気になる点を遠慮なく言う" },
  },
  {
    id: "idea",
    name: "発想",
    pos: { letter: "G", label: "堅実", desc: "正確さと根拠を大事にする" },
    neg: { letter: "V", label: "冒険", desc: "大胆な案や意外な切り口を出す" },
  },
  {
    id: "talk",
    name: "話し方",
    pos: { letter: "B", label: "簡潔", desc: "結論だけを短く言う" },
    neg: { letter: "D", label: "伴走", desc: "理由や考えた道筋まで話す" },
  },
];

// タイプコードの各文字が pos 側かどうか
export function sidesOf(code: string): boolean[] {
  return AXES.map((axis, i) => code[i] === axis.pos.letter);
}
