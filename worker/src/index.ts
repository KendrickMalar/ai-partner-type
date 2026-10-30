import { DurableObject } from "cloudflare:workers";
import {
  COUNTDOWN_MS, MAX_PLAYERS, START_DELAY_MS, cleanName, isTypeCode,
  type ClientMessage, type LobbyPlayer, type ServerMessage,
} from "./protocol";

interface Env {
  ARENA: DurableObjectNamespace<Arena>;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      // 部屋分けは1つの Durable Object がまとめて受け持つ（8人×数部屋なら十分）
      const stub = env.ARENA.get(env.ARENA.idFromName("main"));
      return stub.fetch(req);
    }
    return new Response("ai-partner-type arena", { status: 200 });
  },
};

interface Member extends LobbyPlayer {
  ws: WebSocket;
}

interface Room {
  id: string;
  members: Map<string, Member>;
  countdownEnd: number | null;
  timer: ReturnType<typeof setTimeout> | null;
}

export class Arena extends DurableObject<Env> {
  private rooms = new Map<string, Room>();
  private nextRoom = 1;

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.handle(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private handle(ws: WebSocket) {
    let member: Member | null = null;
    let room: Room | null = null;

    ws.addEventListener("message", (ev) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (msg.type === "join" && !member) {
        if (!isTypeCode(msg.code)) {
          send(ws, { type: "error", message: "タイプが正しくありません" });
          ws.close(1008, "bad code");
          return;
        }
        room = this.pickRoom();
        const id = crypto.randomUUID().slice(0, 8);
        member = { id, name: cleanName(msg.name) || "ななしボット", code: msg.code, ready: false, ws };
        room.members.set(id, member);
        send(ws, { type: "welcome", id, room: room.id });
        this.broadcastLobby(room);
      } else if (msg.type === "ready" && member && room) {
        member.ready = true;
        this.updateCountdown(room);
        this.broadcastLobby(room);
      }
    });

    const leave = () => {
      if (!member || !room) return;
      room.members.delete(member.id);
      if (room.members.size === 0) {
        if (room.timer) clearTimeout(room.timer);
        this.rooms.delete(room.id);
      } else {
        this.updateCountdown(room);
        this.broadcastLobby(room);
      }
      member = null;
    };
    ws.addEventListener("close", leave);
    ws.addEventListener("error", leave);
  }

  private pickRoom(): Room {
    for (const r of this.rooms.values()) {
      if (r.members.size < MAX_PLAYERS) return r;
    }
    const room: Room = { id: String(this.nextRoom++), members: new Map(), countdownEnd: null, timer: null };
    this.rooms.set(room.id, room);
    return room;
  }

  private readyMembers(room: Room): Member[] {
    return [...room.members.values()].filter((m) => m.ready);
  }

  // 2人以上が ready になったら30秒の秒読み。全員 ready ならすぐ始める
  private updateCountdown(room: Room) {
    const ready = this.readyMembers(room).length;
    if (ready < 2) {
      if (room.timer) clearTimeout(room.timer);
      room.timer = null;
      room.countdownEnd = null;
      return;
    }
    if (ready === room.members.size) {
      this.start(room);
      return;
    }
    if (room.countdownEnd === null) {
      room.countdownEnd = Date.now() + COUNTDOWN_MS;
      room.timer = setTimeout(() => this.start(room), COUNTDOWN_MS);
    }
  }

  private start(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.countdownEnd = null;
    const fighters = this.readyMembers(room);
    if (fighters.length < 2) return;
    const msg: ServerMessage = {
      type: "start",
      seed: (Math.random() * 2 ** 31) | 0,
      entrants: fighters.map(({ id, name, code }) => ({ id, name, code })),
      startAt: Date.now() + START_DELAY_MS,
      now: Date.now(),
    };
    for (const m of room.members.values()) send(m.ws, msg);
    // 戦った人は ready を外す。戦いのあと、もう一度 ready を押せばまた戦える
    for (const m of fighters) m.ready = false;
    this.broadcastLobby(room);
  }

  private broadcastLobby(room: Room) {
    const msg: ServerMessage = {
      type: "lobby",
      players: [...room.members.values()].map(({ id, name, code, ready }) => ({ id, name, code, ready })),
      countdownEnd: room.countdownEnd,
      now: Date.now(),
    };
    for (const m of room.members.values()) send(m.ws, msg);
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // 切断済みなら無視
  }
}
