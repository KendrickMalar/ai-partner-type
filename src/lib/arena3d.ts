import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { sidesOf } from "../data/axes";
import { arenaRadius, type Battle, type BattleEvent, type Fighter } from "./battle";
import { robotColor } from "./robot";

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
  mats: THREE.MeshStandardMaterial[];
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
function buildRobot(code: string): { body: THREE.Group; mats: THREE.MeshStandardMaterial[] } {
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
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { body: g, mats };
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
    const { body, mats } = buildRobot(code);
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
    this.scene.add(group);
    const bot: Bot = {
      id, group, body, label, labelCtx: canvas.getContext("2d")!, labelTex, name, mine,
      hpShown: -1, flash: 0, windup: 0, lunge: 0, ko: 0, mats,
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

  // 1ステップ分の出来事を演出に変える
  effects(events: BattleEvent[], battle: Battle) {
    for (const ev of events) {
      if (ev.t === "windup") {
        const b = this.bots.get(ev.id);
        if (b) b.windup = 0.4;
      } else if (ev.t === "hit" || ev.t === "counter") {
        const from = this.bots.get(ev.id);
        const to = this.bots.get(ev.target);
        if (!from || !to) continue;
        from.lunge = 0.25;
        to.flash = 0.25;
        this.beam(from, to, ev.t === "counter" ? 0x5ce1e6 : ev.t === "hit" && ev.crit ? 0xffd166 : 0xff6b6b);
        const crit = ev.t === "hit" && ev.crit;
        this.float(to, crit ? `会心 ${Math.round(ev.dmg)}` : ev.t === "counter" ? `反撃 ${Math.round(ev.dmg)}` : String(Math.round(ev.dmg)), crit ? "#ffd166" : ev.t === "counter" ? "#5ce1e6" : "#ffffff", crit ? 1.6 : 1);
      } else if (ev.t === "miss") {
        const b = this.bots.get(ev.target);
        if (b) this.float(b, "ミス", "#a0a4b8", 0.8);
      } else if (ev.t === "ko") {
        const b = this.bots.get(ev.id);
        if (b) {
          b.ko = 0.001;
          this.float(b, "KO!", "#ff2d55", 1.8);
        }
      }
    }
    void battle;
  }

  private beam(from: Bot, to: Bot, color: number) {
    const a = from.group.position.clone().setY(1.3);
    const b = to.group.position.clone().setY(1.3);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true }));
    this.scene.add(line);
    this.beams.push({ line, life: 0.25 });
  }

  private float(bot: Bot, text: string, color: string, scale: number) {
    const s = textSprite(text, color);
    s.scale.multiplyScalar(scale);
    s.position.copy(bot.group.position).setY(3.6);
    s.position.x += (Math.random() - 0.5) * 0.6;
    this.scene.add(s);
    this.floaters.push({ sprite: s, life: 1.1, vy: 1.4 });
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
      }
      // 待機中・移動中は小さく弾む
      bot.body.position.y = bot.ko ? bot.body.position.y : Math.abs(Math.sin(t * 6 + bot.id.charCodeAt(0))) * 0.08;
      // ため: ふくらむ。攻撃: 前に出る
      bot.windup = Math.max(0, bot.windup - dt);
      bot.lunge = Math.max(0, bot.lunge - dt);
      const swell = 1.1 * (bot.windup > 0 ? 1 + (0.4 - bot.windup) * 0.5 : 1);
      bot.body.scale.setScalar(swell);
      bot.body.position.z = bot.lunge > 0 ? Math.sin((bot.lunge / 0.25) * Math.PI) * 0.6 : 0;
      bot.flash = Math.max(0, bot.flash - dt);
      for (const m of bot.mats) m.emissive.setHex(bot.flash > 0 ? 0xff2d55 : bot.windup > 0 ? 0x553300 : 0x000000);
      const star = bot.body.getObjectByName("star");
      if (star) star.rotation.y += dt * 3;
      if (bot.ko) {
        bot.ko += dt;
        bot.body.rotation.x = Math.min(Math.PI / 2, bot.ko * 4);
        bot.body.position.y = -Math.max(0, bot.ko - 0.8) * 0.8;
        bot.label.visible = bot.ko < 0.8;
      }
      if (bot.mine && !bot.ko) {
        this.arrow.visible = true;
        this.arrow.position.set(bot.group.position.x, 3.8 + Math.sin(t * 4) * 0.15, bot.group.position.z);
      }
    }
    if (![...this.bots.values()].some((b) => b.mine && !b.ko)) this.arrow.visible = false;

    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.material.opacity = Math.min(1, f.life * 2);
      if (f.life <= 0) this.scene.remove(f.sprite);
      return f.life > 0;
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
    this.renderer.render(this.scene, this.camera);
  }
}
