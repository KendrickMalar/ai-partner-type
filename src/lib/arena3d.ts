import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { sidesOf } from "../data/axes";
import { arenaRadius, type Battle, type BattleEvent, type Fighter } from "./battle";
import { robotColor } from "./robot";
import { SKILLS } from "../data/skills";

const INK = 0x2b2d42;

interface Bot {
  id: string;
  group: THREE.Group;
  body: THREE.Group;
  label: THREE.Sprite;
  labelCtx: CanvasRenderingContext2D;
  labelTex: THREE.CanvasTexture;
  name: string;
  mine: boolean;
  hpShown: number;
  flash: number;
  windup: number;
  lunge: number;
  ko: number;
  glow: number;
  shield: THREE.Mesh;
  mats: THREE.MeshStandardMaterial[];
  code: string;
  fists: THREE.Mesh[];
  act: Act | null;
  stars: THREE.Group;
  mark: THREE.Mesh;
  down: THREE.Sprite;
}

// 体の動き（演出だけ。勝敗の計算には関わらない）
type ActKind =
  | "jab" | "shot" | "tackle" | "spin" | "hop" | "lean"
  | "spinFast" | "rise" | "triple" | "slam" | "swing" | "point" | "bigSlam" | "twirl" | "guard" | "shush" | "cheer" | "pulse" | "fire";
interface Act {
  kind: ActKind;
  t: number;
  dur: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  gravity: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  onHit: () => void;
}

interface Floater {
  sprite: THREE.Sprite;
  life: number;
  vy: number;
}

function mat(color: number | string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 });
}

// 診断のロボットと同じ部品の対応で、図形を組み合わせて3Dのロボットを作る
function buildRobot(code: string): { body: THREE.Group; mats: THREE.MeshStandardMaterial[]; fists: THREE.Mesh[] } {
  const [ahead, cheer, steady, brief] = sidesOf(code);
  const color = robotColor(code);
  const g = new THREE.Group();
  const main = mat(color);
  const white = mat(0xffffff);
  const ink = mat(INK);
  const yellow = mat(0xffd166);
  const mats = [main, white];

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), main);
  torso.position.y = 0.45;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), white);
  chest.rotation.x = Math.PI / 2;
  chest.position.set(0, 0.45, 0.36);
  g.add(torso, chest);

  const head = steady
    ? new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.95, 0.9), main)
    : new THREE.Mesh(new THREE.SphereGeometry(0.66, 24, 16), main);
  head.position.y = 1.35;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.05), white);
  face.position.set(0, 1.35, steady ? 0.46 : 0.6);
  g.add(head, face);
  const fz = face.position.z + 0.04;

  // 目（温度）
  for (const side of [-1, 1]) {
    if (cheer) {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16, Math.PI), ink);
      eye.position.set(side * 0.2, 1.4, fz);
      g.add(eye);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat(0xff8fa3));
      cheek.position.set(side * 0.3, 1.27, fz);
      g.add(cheek);
    } else {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.03), ink);
      eye.position.set(side * 0.2, 1.4, fz);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), ink);
      brow.position.set(side * 0.2, 1.52, fz);
      brow.rotation.z = side * 0.35;
      g.add(eye, brow);
    }
  }
  // 口（話し方）
  if (brief) {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.03), ink);
    mouth.position.set(0, 1.2, fz);
    g.add(mouth);
  } else {
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), ink);
    mouth.scale.set(1.3, 0.8, 0.4);
    mouth.position.set(0, 1.2, fz);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), white);
    bubble.position.set(0.85, 1.65, 0);
    g.add(mouth, bubble);
  }
  // 主導
  if (ahead) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45), ink);
    stick.position.set(0.1, 2.0, 0);
    stick.rotation.z = -0.3;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), yellow);
    ball.position.set(0.18, 2.24, 0);
    g.add(stick, ball);
  } else {
    for (const side of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.3), main);
      bolt.position.set(side * (steady ? 0.66 : 0.7), 1.35, 0);
      g.add(bolt);
    }
  }
  // 発想: 冒険はきらきらの星
  if (!steady) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), yellow);
    star.position.set(-0.7, 1.95, 0);
    star.name = "star";
    g.add(star);
  }
  // こぶし（攻撃の演出に使う）
  const fists = [-1, 1].map((side) => {
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), main);
    fist.position.set(side * 0.6, 0.55, 0.15);
    g.add(fist);
    return fist;
  });
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { body: g, mats, fists };
}

function textSprite(text: string, color: string, size = 64): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `900 ${size}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#1b1d2e";
  ctx.strokeText(text, 128, 48);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 48);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
  sprite.scale.set(1.6, 0.6, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export class ArenaView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private bots = new Map<string, Bot>();
  private floaters: Floater[] = [];
  private beams: { line: THREE.Line; life: number }[] = [];
  private rings: { mesh: THREE.Mesh; life: number; max: number; grow: number }[] = [];
  private particles: Particle[] = [];
  private projectiles: Projectile[] = [];
  private shake = 0;
  private sparkGeo = new THREE.SphereGeometry(0.08, 6, 4);
  private platform: THREE.Mesh;
  private danger: THREE.Mesh;
  private zoneRing: THREE.Mesh;
  private arrow: THREE.Mesh;
  private shownZone = -1;
  private radius = arenaRadius(8);
  private clock = new THREE.Clock();
  private myId: string | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(0x1b1d2e);
    this.scene.fog = new THREE.Fog(0x1b1d2e, 30, 70);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 9, 12);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 45;

    this.scene.add(new THREE.HemisphereLight(0xdde6ff, 0x3a2f4f, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -20;
    sc.right = sc.top = 20;
    this.scene.add(sun);

    this.platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.04, 0.6, 64),
      new THREE.MeshStandardMaterial({ color: 0x3d4060, roughness: 0.9 }),
    );
    this.platform.position.y = -0.3;
    this.platform.receiveShadow = true;
    this.scene.add(this.platform);

    this.danger = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    this.danger.rotation.x = -Math.PI / 2;
    this.danger.position.y = 0.02;
    this.scene.add(this.danger);

    this.zoneRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x5ce1e6 }),
    );
    this.zoneRing.rotation.x = Math.PI / 2;
    this.zoneRing.position.y = 0.05;
    this.scene.add(this.zoneRing);

    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 16), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    this.arrow.rotation.x = Math.PI;
    this.arrow.visible = false;
    this.scene.add(this.arrow);

    this.setRadius(this.radius);
    this.setZone(this.radius);
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private setRadius(r: number) {
    this.radius = r;
    this.platform.scale.set(r, 1, r);
  }

  private setZone(z: number) {
    if (Math.abs(z - this.shownZone) < 0.02) return;
    this.shownZone = z;
    this.zoneRing.geometry.dispose();
    this.zoneRing.geometry = new THREE.TorusGeometry(z, 0.06, 8, 96);
    this.danger.geometry.dispose();
    this.danger.geometry = new THREE.RingGeometry(Math.min(z, this.radius), this.radius + 0.02, 64);
  }

  private clearBots() {
    for (const b of this.bots.values()) this.scene.remove(b.group);
    this.bots.clear();
  }

  private addBot(id: string, name: string, code: string, mine: boolean): Bot {
    const { body, mats, fists } = buildRobot(code);
    const group = new THREE.Group();
    body.scale.setScalar(1.1);
    group.add(body);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 96;
    const labelTex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false }));
    label.scale.set(2.6, 0.78, 1);
    label.position.y = 3.1;
    label.renderOrder = 5;
    group.add(label);
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: 0.25 }),
    );
    shield.position.y = 1.2;
    shield.visible = false;
    group.add(shield);
    // しびれ: 頭の上を回る星
    const stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      st.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.6, 0, Math.sin((i / 3) * Math.PI * 2) * 0.6);
      stars.add(st);
    }
    stars.position.y = 2.6;
    stars.visible = false;
    group.add(stars);
    // 弱点の印: 足元の赤い輪
    const mark = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.1, 32),
      new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.06;
    mark.visible = false;
    group.add(mark);
    // 攻撃力ダウン: 頭の上の矢印
    const down = textSprite("↓", "#b47cff", 80);
    down.scale.set(0.9, 0.34, 1);
    down.position.set(0.9, 2.5, 0);
    down.visible = false;
    group.add(down);
    this.scene.add(group);
    const bot: Bot = {
      id, group, body, label, labelCtx: canvas.getContext("2d")!, labelTex, name, mine,
      hpShown: -1, flash: 0, windup: 0, lunge: 0, ko: 0, glow: 0, shield, mats,
      code, fists, act: null, stars, mark, down,
    };
    this.bots.set(id, bot);
    this.drawLabel(bot, 1, false);
    return bot;
  }

  private drawLabel(bot: Bot, ratio: number, showHp: boolean) {
    const r = Math.round(ratio * 50) / 50;
    if (r === bot.hpShown) return;
    bot.hpShown = r;
    const ctx = bot.labelCtx;
    ctx.clearRect(0, 0, 320, 96);
    ctx.font = `800 34px "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1b1d2e";
    ctx.strokeText(bot.name, 160, 40);
    ctx.fillStyle = bot.mine ? "#ffd166" : "#ffffff";
    ctx.fillText(bot.name, 160, 40);
    if (showHp) {
      ctx.fillStyle = "#1b1d2e";
      ctx.fillRect(40, 58, 240, 22);
      ctx.fillStyle = r > 0.5 ? "#4ade80" : r > 0.25 ? "#facc15" : "#f43f5e";
      ctx.fillRect(43, 61, 234 * r, 16);
    }
    bot.labelTex.needsUpdate = true;
  }

  // 待合室: 参加者を円形に並べる（表示だけなので三角関数を使ってよい）
  showLobby(players: { id: string; name: string; code: string; ready: boolean }[], myId: string | null) {
    this.myId = myId;
    this.clearBots();
    this.setRadius(arenaRadius(8));
    this.setZone(this.radius);
    players.forEach((p, i) => {
      const bot = this.addBot(p.id, p.name, p.code, p.id === myId);
      const a = (i / Math.max(players.length, 1)) * Math.PI * 2;
      const r = players.length === 1 ? 0 : 4.5;
      bot.group.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      bot.group.lookAt(0, 0, 0);
      if (p.ready) bot.group.position.y = 0.01;
    });
  }

  startBattle(battle: Battle, myId: string | null) {
    this.myId = myId;
    this.clearBots();
    this.setRadius(arenaRadius(battle.fighters.length));
    for (const f of battle.fighters) {
      const bot = this.addBot(f.id, f.name, f.code, f.id === myId);
      bot.group.position.set(f.x, 0, f.z);
      this.drawLabel(bot, 1, true);
    }
  }

  // ふだんの攻撃の動き: 話し方×発想で4種類
  private attackStyle(bot: Bot): ActKind {
    const [, , steady, brief] = sidesOf(bot.code);
    if (brief) return steady ? "jab" : "shot";
    return steady ? "tackle" : "spin";
  }

  private sparkColor(bot: Bot): number {
    return sidesOf(bot.code)[1] ? 0xff8fa3 : 0xff9e00;
  }

  private play(bot: Bot, kind: ActKind, dur: number) {
    bot.act = { kind, t: 0, dur };
  }

  // 1ステップ分の出来事を演出に変える
  effects(events: BattleEvent[], battle: Battle) {
    for (const ev of events) {
      if (ev.t === "windup") {
        const b = this.bots.get(ev.id);
        if (!b) continue;
        b.windup = 0.27;
        // 先回りは跳ねて構え、待機は身をひいて構える
        if (!b.act) this.play(b, sidesOf(b.code)[0] ? "hop" : "lean", 0.27);
      } else if (ev.t === "hit" || ev.t === "counter") {
        const from = this.bots.get(ev.id);
        const to = this.bots.get(ev.target);
        if (!from || !to) continue;
        const crit = ev.t === "hit" && ev.crit;
        const text = crit ? `会心 ${Math.round(ev.dmg)}` : ev.t === "counter" ? `反撃 ${Math.round(ev.dmg)}` : String(Math.round(ev.dmg));
        const color = crit ? "#ffd166" : ev.t === "counter" ? "#5ce1e6" : "#ffffff";
        const land = () => {
          to.flash = 0.25;
          this.burst(to.group.position, crit ? 0xffd166 : this.sparkColor(from), crit ? 18 : 8, crit ? 4 : 2.5);
          this.float(to, text, color, crit ? 1.6 : 1);
          if (crit) this.shake = Math.max(this.shake, 0.25);
        };
        // 必殺技の最中は、技の動きをそのまま続ける
        const inSkill = !!from.act && from.act.dur > 0.45;
        if (ev.t === "counter") {
          if (!inSkill) this.play(from, "jab", 0.25);
          land();
        } else if (inSkill) {
          land();
        } else {
          const style = this.attackStyle(from);
          this.play(from, style, style === "spin" ? 0.4 : 0.28);
          if (style === "shot") this.shoot(from, to, this.sparkColor(from), 0.18, 0.2, land);
          else land();
        }
      } else if (ev.t === "skill") {
        const b = this.bots.get(ev.id);
        if (!b) continue;
        const to = ev.target ? this.bots.get(ev.target) : undefined;
        b.glow = 0.6;
        this.float(b, ev.name, "#ffd166", 2.2, 1.6);
        this.pulse(b.group.position, 0xffd166, 0.6, 6);
        this.skillAction(b, to, battle);
      } else if (ev.t === "heal") {
        const b = this.bots.get(ev.id);
        if (b && ev.amount > 0) this.float(b, `+${ev.amount}`, "#4ade80", 1.2);
      } else if (ev.t === "miss") {
        const from = this.bots.get(ev.id);
        const b = this.bots.get(ev.target);
        if (from && !from.act) this.play(from, this.attackStyle(from), 0.28);
        if (b) this.float(b, "ミス", "#a0a4b8", 0.8);
      } else if (ev.t === "ko") {
        const b = this.bots.get(ev.id);
        if (b) {
          b.ko = 0.001;
          b.act = null;
          this.float(b, "KO!", "#ff2d55", 1.8);
          this.burst(b.group.position, 0xff2d55, 24, 5);
          this.shake = Math.max(this.shake, 0.35);
        }
      }
    }
  }

  // 必殺技ごとの動きと効果
  private skillAction(b: Bot, to: Bot | undefined, battle: Battle) {
    const kind = SKILLS[b.code]?.kind;
    const pos = b.group.position;
    const around = battle.fighters.filter((f) => f.alive && f.id !== b.id && Math.hypot(f.x - pos.x, f.z - pos.z) <= 3.5);
    switch (kind) {
      case "haste":
        this.play(b, "spinFast", 0.6);
        this.burst(pos, 0xff9e00, 20, 3, 0.2);
        break;
      case "heal":
        this.play(b, "rise", 0.8);
        this.fountain(pos, 0x4ade80, 24);
        break;
      case "multi":
        this.play(b, "triple", 0.6);
        if (to) [0, 0.2, 0.4].forEach((d) => setTimeout(() => this.burst(to.group.position, 0xff8fa3, 8, 3), d * 1000));
        break;
      case "blast":
        this.play(b, "slam", 0.6);
        setTimeout(() => {
          this.pulse(b.group.position, 0xff4d6d, 0.5, 7, 0.25);
          this.burst(b.group.position, 0xff4d6d, 30, 6);
          this.shake = Math.max(this.shake, 0.45);
        }, 380);
        break;
      case "stunHit":
        this.play(b, "swing", 0.5);
        if (to) setTimeout(() => this.burst(to.group.position, 0xffd166, 16, 4), 300);
        break;
      case "mark":
        this.play(b, "point", 0.5);
        if (to) this.shoot(b, to, 0xff2d55, 0.12, 0.25, () => this.pulse(to.group.position, 0xff2d55, 0.5, 3));
        break;
      case "smash":
        this.play(b, "bigSlam", 0.7);
        if (to) setTimeout(() => {
          this.burst(to.group.position, 0xffd166, 36, 7);
          this.pulse(to.group.position, 0xffd166, 0.5, 5);
          this.shake = Math.max(this.shake, 0.6);
        }, 450);
        break;
      case "swap":
        this.play(b, "twirl", 0.8);
        if (to) {
          this.play(to, "twirl", 0.8);
          this.shoot(b, to, 0xb47cff, 0.25, 0.5, () => this.burst(to.group.position, 0xb47cff, 14, 3));
          this.shoot(to, b, 0xb47cff, 0.25, 0.5, () => this.burst(b.group.position, 0xb47cff, 14, 3));
        }
        break;
      case "shield":
        this.play(b, "guard", 0.6);
        this.pulse(pos, 0x5ce1e6, 0.5, 3);
        break;
      case "hush":
        this.play(b, "shush", 0.6);
        this.float(b, "シーッ", "#5ce1e6", 1.6, 1.2);
        this.pulse(pos, 0x5ce1e6, 0.7, 7, 0.2);
        break;
      case "cheer":
        this.play(b, "cheer", 0.8);
        this.confetti(pos);
        break;
      case "reflect":
        this.play(b, "twirl", 0.6);
        this.pulse(pos, 0xff9e00, 0.5, 3);
        break;
      case "sharpen":
        this.play(b, "pulse", 0.6);
        this.burst(pos, 0xffffff, 16, 2, 1.6);
        break;
      case "percent":
        this.play(b, "point", 0.5);
        if (to) {
          this.skyBeam(to.group.position, 0xff2d55);
          setTimeout(() => this.float(to, "却下", "#ff2d55", 2.4, 1.2), 200);
        }
        break;
      case "warp":
        this.play(b, "fire", 0.6);
        if (to) this.shoot(b, to, 0x5ce1e6, 0.3, 0.7, () => {
          this.burst(to.group.position, 0xff9e00, 40, 7);
          this.pulse(to.group.position, 0xff9e00, 0.5, 5);
          this.shake = Math.max(this.shake, 0.5);
        }, 3);
        break;
      case "weaken":
        this.play(b, "shush", 0.6);
        for (const f of around) {
          const o = this.bots.get(f.id);
          if (o) this.burst(o.group.position, 0x6b3fa0, 14, 1.5, 1.8);
        }
        break;
    }
  }

  // 空から目標に落ちる光の柱
  private skyBeam(at: THREE.Vector3, color: number) {
    const a = at.clone().setY(12);
    const b = at.clone().setY(0);
    for (const dx of [-0.08, 0, 0.08]) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a.clone().setX(a.x + dx), b.clone().setX(b.x + dx)]),
        new THREE.LineBasicMaterial({ color, transparent: true }),
      );
      this.scene.add(line);
      this.beams.push({ line, life: 0.5 });
    }
    this.burst(at, color, 20, 4);
  }

  private pulse(at: THREE.Vector3, color: number, life: number, grow: number, y = 0.08) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).setY(y);
    this.scene.add(ring);
    this.rings.push({ mesh: ring, life, max: life, grow });
  }

  private spawn(at: THREE.Vector3, color: number, vel: THREE.Vector3, life: number, gravity: number, size = 1) {
    const mesh = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.scale.setScalar(size);
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.particles.push({ mesh, vel, life, max: life, gravity });
  }

  // 火花が四方に飛ぶ
  private burst(at: THREE.Vector3, color: number, n: number, speed: number, y = 1.2) {
    const o = at.clone().setY(y);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.spawn(o, color, v, 0.5 + Math.random() * 0.3, 6);
    }
  }

  // 下から湧き上がる光（回復）
  private fountain(at: THREE.Vector3, color: number, n: number) {
    for (let i = 0; i < n; i++) {
      const o = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 0.5, (Math.random() - 0.5) * 1.4));
      this.spawn(o, color, new THREE.Vector3(0, 1.5 + Math.random() * 1.5, 0), 0.9, -0.5, 1.4);
    }
  }

  // 紙ふぶき（応援）
  private confetti(at: THREE.Vector3) {
    const colors = [0xff4d6d, 0xffd166, 0x4ade80, 0x5ce1e6, 0xb47cff];
    for (let i = 0; i < 30; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 4 + Math.random() * 2, (Math.random() - 0.5) * 3);
      this.spawn(at.clone().setY(2), colors[i % colors.length], v, 1.2, 7, 1.2);
    }
  }

  // 飛び道具。届いたら onHit を呼ぶ
  private shoot(from: Bot, to: Bot, color: number, size: number, dur: number, onHit: () => void, arc = 0.6) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color }));
    const a = from.group.position.clone().setY(1.2);
    mesh.position.copy(a);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, from: a, to: to.group.position.clone().setY(1.2), t: 0, dur, arc, onHit });
  }

  private float(bot: Bot, text: string, color: string, scale: number, life = 1.1) {
    const s = textSprite(text, color, text.length > 4 ? 40 : 64);
    s.scale.multiplyScalar(scale);
    s.position.copy(bot.group.position).setY(3.6);
    s.position.x += (Math.random() - 0.5) * 0.6;
    this.scene.add(s);
    this.floaters.push({ sprite: s, life, vy: 1.4 });
  }

  // 体の動きを1フレーム分あてる（body のローカル座標。+z が相手の方向）
  private animate(bot: Bot, dt: number) {
    const body = bot.body;
    const [l, r] = bot.fists;
    l.position.set(-0.6, 0.55, 0.15);
    r.position.set(0.6, 0.55, 0.15);
    l.scale.setScalar(1);
    r.scale.setScalar(1);
    body.rotation.set(0, 0, 0);
    body.position.x = 0;
    body.position.z = 0;
    const act = bot.act;
    if (!act) return;
    act.t += dt;
    const p = Math.min(1, act.t / act.dur);
    const bump = Math.sin(p * Math.PI); // 0→1→0
    switch (act.kind) {
      case "jab":
        r.position.z = 0.15 + bump * 1.0;
        r.scale.setScalar(1 + bump * 0.4);
        break;
      case "shot":
        r.position.z = 0.15 + bump * 0.6;
        body.position.z = -bump * 0.15;
        break;
      case "tackle":
        body.position.z = bump * 1.0;
        body.rotation.x = bump * 0.35;
        break;
      case "spin":
        body.rotation.y = p * Math.PI * 2;
        body.position.z = bump * 0.7;
        l.position.x = -0.6 - bump * 0.4;
        r.position.x = 0.6 + bump * 0.4;
        break;
      case "hop":
        body.position.y += bump * 0.4;
        break;
      case "lean":
        body.rotation.x = -bump * 0.25;
        break;
      case "spinFast":
        body.rotation.y = p * Math.PI * 4;
        break;
      case "rise":
        body.position.y += bump * 0.6;
        l.position.y = r.position.y = 0.55 + bump * 0.8;
        break;
      case "triple": {
        const k = (p * 3) % 1;
        const fist = Math.floor(p * 3) % 2 === 0 ? r : l;
        fist.position.z = 0.15 + Math.sin(k * Math.PI) * 1.0;
        body.position.z = Math.sin(k * Math.PI) * 0.2;
        break;
      }
      case "slam":
        // 跳んで、たたきつける
        body.position.y += p < 0.6 ? Math.sin((p / 0.6) * Math.PI * 0.5) * 1.8 : 1.8 * Math.pow(1 - (p - 0.6) / 0.4, 3);
        l.position.y = r.position.y = 0.55 + (p < 0.6 ? 0.9 : 0);
        break;
      case "swing":
        body.rotation.y = -bump * 1.2 + (p > 0.5 ? (p - 0.5) * 4 * Math.PI : 0);
        r.scale.setScalar(1 + bump * 1.2);
        r.position.z = 0.15 + bump * 0.6;
        break;
      case "point":
        r.position.set(0.3, 1.0, 0.15 + bump * 1.1);
        break;
      case "bigSlam":
        body.position.y += Math.sin(Math.min(1, p / 0.65) * Math.PI) * 1.4;
        r.scale.setScalar(1 + bump * 2.5);
        r.position.set(0.4, 0.55 + bump * 1.2, 0.15 + bump * 0.9);
        body.rotation.x = p > 0.5 ? (p - 0.5) * 1.2 : 0;
        break;
      case "twirl":
        body.rotation.y = p * Math.PI * 2;
        body.position.y += bump * 0.8;
        break;
      case "guard":
        l.position.set(-0.15, 0.9, 0.55);
        r.position.set(0.15, 0.9, 0.55);
        body.rotation.x = -bump * 0.15;
        break;
      case "shush":
        r.position.set(0, 1.2, 0.75);
        body.rotation.x = bump * 0.12;
        break;
      case "cheer":
        body.position.y += Math.abs(Math.sin(p * Math.PI * 2)) * 0.6;
        l.position.set(-0.7, 0.55 + bump * 1.3, 0.1);
        r.position.set(0.7, 0.55 + bump * 1.3, 0.1);
        break;
      case "pulse":
        body.scale.setScalar(1.1 * (1 + bump * 0.2));
        break;
      case "fire":
        body.position.z = -bump * 0.4;
        body.rotation.x = -bump * 0.3;
        r.position.z = 0.15 + bump * 0.5;
        break;
    }
    if (act.t >= act.dur) bot.act = null;
  }

  // 毎フレーム: シミュレーションの位置に寄せて描く
  frame(battle: Battle | null) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    if (battle) this.setZone(battle.zone());
    for (const bot of this.bots.values()) {
      const f: Fighter | undefined = battle?.fighters.find((x) => x.id === bot.id);
      if (f) {
        const p = bot.group.position;
        p.x += (f.x - p.x) * Math.min(1, dt * 10);
        p.z += (f.z - p.z) * Math.min(1, dt * 10);
        const target = f.target ? battle!.fighters.find((x) => x.id === f.target) : undefined;
        if (target && f.alive) bot.group.lookAt(target.x, 0, target.z);
        this.drawLabel(bot, f.hp / f.maxHp, f.alive);
        // 状態の表示: 守り・反射は泡、しびれは星、弱点は赤い輪、攻撃力ダウンは矢印
        bot.shield.visible = f.alive && (f.shield > 0 || f.reflect > 0);
        (bot.shield.material as THREE.MeshBasicMaterial).color.setHex(f.reflect > 0 ? 0xff9e00 : 0x5ce1e6);
        bot.shield.rotation.y += dt;
        bot.stars.visible = f.alive && f.stun > 0;
        bot.stars.rotation.y += dt * 6;
        bot.mark.visible = f.alive && f.vuln > 0;
        bot.mark.scale.setScalar(1 + Math.sin(t * 8) * 0.1);
        bot.down.visible = f.alive && f.weak > 0;
        bot.down.position.y = 2.5 + Math.sin(t * 5) * 0.1;
      }
      // 待機中・移動中は小さく弾む
      bot.body.position.y = bot.ko ? bot.body.position.y : Math.abs(Math.sin(t * 6 + bot.id.charCodeAt(0))) * 0.08;
      bot.windup = Math.max(0, bot.windup - dt);
      const swell = 1.1 * (bot.windup > 0 ? 1 + (0.27 - bot.windup) * 0.75 : 1);
      if (!bot.ko) {
        bot.body.scale.setScalar(swell);
        this.animate(bot, dt);
        if (f && f.stun > 0) bot.body.rotation.y += Math.sin(t * 40) * 0.15;
      }
      bot.flash = Math.max(0, bot.flash - dt);
      bot.glow = Math.max(0, bot.glow - dt);
      for (const m of bot.mats) m.emissive.setHex(bot.flash > 0 ? 0xff2d55 : bot.glow > 0 ? 0x806000 : bot.windup > 0 ? 0x553300 : 0x000000);
      const star = bot.body.getObjectByName("star");
      if (star) star.rotation.y += dt * 3;
      if (bot.ko) {
        bot.ko += dt;
        bot.body.rotation.x = Math.min(Math.PI / 2, bot.ko * 4);
        bot.body.position.y = -Math.max(0, bot.ko - 0.8) * 0.8;
        bot.label.visible = bot.ko < 0.8;
        bot.shield.visible = bot.stars.visible = bot.mark.visible = bot.down.visible = false;
      }
      if (bot.mine && !bot.ko) {
        this.arrow.visible = true;
        this.arrow.position.set(bot.group.position.x, 3.8 + Math.sin(t * 4) * 0.15, bot.group.position.z);
      }
    }
    if (![...this.bots.values()].some((b) => b.mine && !b.ko)) this.arrow.visible = false;

    this.projectiles = this.projectiles.filter((pr) => {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      pr.mesh.position.lerpVectors(pr.from, pr.to, k);
      pr.mesh.position.y += Math.sin(k * Math.PI) * pr.arc;
      if (Math.random() < 0.6) this.spawn(pr.mesh.position, (pr.mesh.material as THREE.MeshBasicMaterial).color.getHex(), new THREE.Vector3(0, 0.3, 0), 0.3, 0, 0.7);
      if (k >= 1) {
        this.scene.remove(pr.mesh);
        pr.onHit();
      }
      return k < 1;
    });
    this.particles = this.particles.filter((pa) => {
      pa.life -= dt;
      pa.vel.y -= pa.gravity * dt;
      pa.mesh.position.addScaledVector(pa.vel, dt);
      if (pa.mesh.position.y < 0.05) {
        pa.mesh.position.y = 0.05;
        pa.vel.multiplyScalar(0.5);
      }
      (pa.mesh.material as THREE.MeshBasicMaterial).opacity = pa.life / pa.max;
      if (pa.life <= 0) {
        this.scene.remove(pa.mesh);
        (pa.mesh.material as THREE.Material).dispose();
      }
      return pa.life > 0;
    });
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.material.opacity = Math.min(1, f.life * 2);
      if (f.life <= 0) this.scene.remove(f.sprite);
      return f.life > 0;
    });
    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      r.mesh.scale.setScalar(1 + (r.max - r.life) * r.grow);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = r.life / r.max;
      if (r.life <= 0) this.scene.remove(r.mesh);
      return r.life > 0;
    });
    this.beams = this.beams.filter((b) => {
      b.life -= dt;
      (b.line.material as THREE.LineBasicMaterial).opacity = b.life * 4;
      if (b.life <= 0) this.scene.remove(b.line);
      return b.life > 0;
    });

    // カメラは生き残っているBotの中心を追う
    const alive = [...this.bots.values()].filter((b) => !b.ko);
    if (alive.length) {
      const cx = alive.reduce((v, b) => v + b.group.position.x, 0) / alive.length;
      const cz = alive.reduce((v, b) => v + b.group.position.z, 0) / alive.length;
      const k = Math.min(1, dt * 2);
      const dx = (cx - this.controls.target.x) * k;
      const dz = (cz - this.controls.target.z) * k;
      this.controls.target.x += dx;
      this.controls.target.z += dz;
      this.camera.position.x += dx;
      this.camera.position.z += dz;
    }
    this.controls.update();
    // 大技のときは画面をゆらす
    this.shake = Math.max(0, this.shake - dt);
    const off = new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0);
    this.camera.position.add(off);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.sub(off);
  }
}
