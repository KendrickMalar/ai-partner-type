import { sidesOf } from "../data/axes";

// 全員のブラウザで同じ結果になるよう、乱数は種から作り、三角関数は使わない（sqrt だけ使う）

export interface Entrant {
  id: string;
  name: string;
  code: string;
}

export interface Fighter extends Entrant {
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  target: string | null;
  cooldown: number;
  windup: number; // >0 のあいだ攻撃の「ため」
  streak: number; // 伴走: 同じ相手への連続命中数
  place: number; // 脱落順から決まる順位（生存中は 0）
}

export type BattleEvent =
  | { t: "windup"; id: string; target: string }
  | { t: "hit"; id: string; target: string; dmg: number; crit: boolean }
  | { t: "miss"; id: string; target: string }
  | { t: "counter"; id: string; target: string; dmg: number }
  | { t: "zone"; id: string; dmg: number }
  | { t: "ko"; id: string; place: number }
  | { t: "end"; winner: string };

export const TICK = 0.1;
const sq = (v: number) => v * v;
const BASE = { hp: 300, atk: 10, interval: 1.2, speed: 2.4, range: 1.6, windup: 0.4 };

interface Stats {
  maxHp: number;
  atk: number;
  interval: number;
  speed: number;
  taken: number; // 受けるダメージ倍率
  regen: number;
  hit: number;
  crit: number;
  counter: number;
  sticky: boolean;
}

// 軸ごとの得と損（仮の値。発表後に勝率を見て調整する）
export function statsOf(code: string): Stats {
  const [ahead, cheer, steady, brief] = sidesOf(code);
  const s: Stats = {
    maxHp: BASE.hp, atk: BASE.atk, interval: BASE.interval, speed: BASE.speed,
    taken: 1, regen: 0, hit: 0.9, crit: 0, counter: 0, sticky: false,
  };
  if (ahead) { s.speed *= 1.2; s.taken *= 1.03; s.atk *= 1.05; } else { s.counter = 0.3; s.speed *= 0.9; }
  if (cheer) { s.regen = 1.1; s.atk *= 0.85; } else { s.atk *= 1.25; s.maxHp *= 0.9; }
  if (steady) { s.hit = 0.97; } else { s.hit = 0.8; s.crit = 0.15; }
  if (brief) { s.interval *= 0.75; s.atk *= 0.9; } else { s.sticky = true; }
  return s;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function arenaRadius(n: number): number {
  return 6 + n * 1.2;
}

// 縮みはじめ・縮み終わりの時刻（人数が多いほど長い）
export function zoneAt(time: number, n: number): number {
  const r0 = arenaRadius(n);
  const start = 20 + n * 4;
  const end = start + 40 + n * 6;
  if (time <= start) return r0;
  if (time >= end) return 1.5;
  return r0 - ((time - start) / (end - start)) * (r0 - 1.5);
}

export class Battle {
  readonly fighters: Fighter[];
  readonly stats: Map<string, Stats>;
  time = 0;
  over = false;
  winner: string | null = null;
  private rand: () => number;
  private n: number;

  constructor(entrants: Entrant[], seed: number) {
    this.rand = rng(seed);
    this.n = entrants.length;
    this.stats = new Map(entrants.map((e) => [e.id, statsOf(e.code)]));
    const r = arenaRadius(this.n) * 0.8;
    // id 順に並べてから配置（参加順の違いで結果が変わらないように）
    const sorted = [...entrants].sort((a, b) => (a.id < b.id ? -1 : 1));
    const placed: { x: number; z: number }[] = [];
    this.fighters = sorted.map((e) => {
      let x = 0, z = 0;
      for (let i = 0; i < 200; i++) {
        x = (this.rand() * 2 - 1) * r;
        z = (this.rand() * 2 - 1) * r;
        if (x * x + z * z > r * r) continue;
        if (placed.every((p) => sq(p.x - x) + sq(p.z - z) > 9)) break;
      }
      placed.push({ x, z });
      const s = this.stats.get(e.id)!;
      return {
        ...e, x, z, hp: s.maxHp, maxHp: s.maxHp, alive: true, target: null,
        cooldown: this.rand() * s.interval, windup: 0, streak: 0, place: 0,
      };
    });
  }

  zone(): number {
    return zoneAt(this.time, this.n);
  }

  private alive(): Fighter[] {
    return this.fighters.filter((f) => f.alive);
  }

  private byId(id: string | null): Fighter | undefined {
    return id ? this.fighters.find((f) => f.id === id) : undefined;
  }

  private nearest(f: Fighter): Fighter | undefined {
    let best: Fighter | undefined;
    let bd = Infinity;
    for (const o of this.fighters) {
      if (!o.alive || o.id === f.id) continue;
      const d = sq(o.x - f.x) + sq(o.z - f.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  private damage(target: Fighter, amount: number, events: BattleEvent[]) {
    target.hp -= amount;
    if (target.hp <= 0 && target.alive) {
      target.hp = 0;
      target.alive = false;
      target.place = this.alive().length + 1;
      events.push({ t: "ko", id: target.id, place: target.place });
    }
  }

  step(): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (this.over) return events;
    this.time += TICK;
    const zone = this.zone();

    for (const f of this.fighters) {
      if (!f.alive) continue;
      const s = this.stats.get(f.id)!;
      f.hp = Math.min(f.maxHp, f.hp + s.regen * TICK);

      // 狙う相手: 伴走は倒すまで同じ相手、簡潔は毎回いちばん近い相手
      let target = this.byId(f.target);
      if (!target || !target.alive || !s.sticky) {
        const next = this.nearest(f);
        if (next?.id !== f.target) f.streak = 0;
        target = next;
        f.target = target?.id ?? null;
      }
      if (!target) continue;

      const dx = target.x - f.x;
      const dz = target.z - f.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (f.windup > 0) {
        f.windup -= TICK;
        if (f.windup <= 0) this.strike(f, target, dist, s, events);
        continue;
      }
      if (dist > BASE.range) {
        const move = Math.min(s.speed * TICK, dist - BASE.range * 0.8);
        f.x += (dx / dist) * move;
        f.z += (dz / dist) * move;
      }
      f.cooldown -= TICK;
      if (f.cooldown <= 0 && dist <= BASE.range) {
        f.windup = BASE.windup;
        events.push({ t: "windup", id: f.id, target: target.id });
      }
    }

    // 安全地帯の外にいると削られる
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const d = Math.sqrt(f.x * f.x + f.z * f.z);
      if (d > zone) {
        const dmg = 15 * TICK;
        events.push({ t: "zone", id: f.id, dmg });
        this.damage(f, dmg, events);
        f.x -= (f.x / d) * 1.5 * TICK;
        f.z -= (f.z / d) * 1.5 * TICK;
      }
    }

    const alive = this.alive();
    if (alive.length <= 1 || this.time > 300) {
      // 時間切れなら HP の多い順で決める
      const ranked = [...alive].sort((a, b) => b.hp - a.hp || (a.id < b.id ? -1 : 1));
      ranked.forEach((f, i) => {
        if (i > 0) { f.alive = false; f.place = i + 1; events.push({ t: "ko", id: f.id, place: f.place }); }
      });
      const w = ranked[0];
      if (w) { w.place = 1; this.winner = w.id; events.push({ t: "end", winner: w.id }); }
      this.over = true;
    }
    return events;
  }

  private strike(f: Fighter, target: Fighter, dist: number, s: Stats, events: BattleEvent[]) {
    f.cooldown = s.interval;
    if (!target.alive || dist > BASE.range * 1.3) {
      events.push({ t: "miss", id: f.id, target: target.id });
      return;
    }
    if (this.rand() > s.hit) {
      f.streak = 0;
      events.push({ t: "miss", id: f.id, target: target.id });
      return;
    }
    const crit = this.rand() < s.crit;
    const ts = this.stats.get(target.id)!;
    let dmg = s.atk * (crit ? 2.5 : 1) * ts.taken * (0.9 + this.rand() * 0.2);
    if (s.sticky) dmg *= 1 + Math.min(f.streak, 5) * 0.03;
    f.streak++;
    dmg = Math.round(dmg * 10) / 10;
    events.push({ t: "hit", id: f.id, target: target.id, dmg, crit });
    this.damage(target, dmg, events);
    // 待機型は殴られたら反撃することがある
    if (target.alive && ts.counter > 0 && this.rand() < ts.counter) {
      const c = Math.round(ts.atk * 0.6 * s.taken * 10) / 10;
      events.push({ t: "counter", id: target.id, target: f.id, dmg: c });
      this.damage(f, c, events);
    }
  }

  // 最後まで回して結果だけ返す（テスト・バランス確認用）
  run(): { winner: string; places: Record<string, number>; time: number } {
    while (!this.over) this.step();
    return {
      winner: this.winner!,
      places: Object.fromEntries(this.fighters.map((f) => [f.id, f.place])),
      time: this.time,
    };
  }
}
