var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { DurableObject } from "cloudflare:workers";

// src/protocol.ts
var MAX_PLAYERS = 8;
var COUNTDOWN_MS = 3e4;
var START_DELAY_MS = 3e3;
var NAME_MAX = 12;
var CODE_RE = /^[SW][CT][GV][BD]$/;
function isTypeCode(code) {
  return typeof code === "string" && CODE_RE.test(code);
}
__name(isTypeCode, "isTypeCode");
function cleanName(raw) {
  if (typeof raw !== "string") return "";
  const stripped = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, "").trim();
  return [...stripped].slice(0, NAME_MAX).join("");
}
__name(cleanName, "cleanName");

// src/index.ts
var src_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      const stub = env.ARENA.get(env.ARENA.idFromName("main"));
      return stub.fetch(req);
    }
    return new Response("ai-partner-type arena", { status: 200 });
  }
};
var Arena = class extends DurableObject {
  static {
    __name(this, "Arena");
  }
  rooms = /* @__PURE__ */ new Map();
  nextRoom = 1;
  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.handle(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  handle(ws) {
    let member = null;
    let room = null;
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (msg.type === "join" && !member) {
        if (!isTypeCode(msg.code)) {
          send(ws, { type: "error", message: "\u30BF\u30A4\u30D7\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093" });
          ws.close(1008, "bad code");
          return;
        }
        room = this.pickRoom();
        const id = crypto.randomUUID().slice(0, 8);
        member = { id, name: cleanName(msg.name) || "\u306A\u306A\u3057\u30DC\u30C3\u30C8", code: msg.code, ready: false, ws };
        room.members.set(id, member);
        send(ws, { type: "welcome", id, room: room.id });
        this.broadcastLobby(room);
      } else if (msg.type === "ready" && member && room) {
        member.ready = true;
        this.updateCountdown(room);
        this.broadcastLobby(room);
      }
    });
    const leave = /* @__PURE__ */ __name(() => {
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
    }, "leave");
    ws.addEventListener("close", leave);
    ws.addEventListener("error", leave);
  }
  pickRoom() {
    for (const r of this.rooms.values()) {
      if (r.members.size < MAX_PLAYERS) return r;
    }
    const room = { id: String(this.nextRoom++), members: /* @__PURE__ */ new Map(), countdownEnd: null, timer: null };
    this.rooms.set(room.id, room);
    return room;
  }
  readyMembers(room) {
    return [...room.members.values()].filter((m) => m.ready);
  }
  // 2人以上が ready になったら30秒の秒読み。全員 ready ならすぐ始める
  updateCountdown(room) {
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
  start(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.countdownEnd = null;
    const fighters = this.readyMembers(room);
    if (fighters.length < 2) return;
    const msg = {
      type: "start",
      seed: Math.random() * 2 ** 31 | 0,
      entrants: fighters.map(({ id, name, code }) => ({ id, name, code })),
      startAt: Date.now() + START_DELAY_MS,
      now: Date.now()
    };
    for (const m of room.members.values()) send(m.ws, msg);
    for (const m of fighters) m.ready = false;
    this.broadcastLobby(room);
  }
  broadcastLobby(room) {
    const msg = {
      type: "lobby",
      players: [...room.members.values()].map(({ id, name, code, ready }) => ({ id, name, code, ready })),
      countdownEnd: room.countdownEnd,
      now: Date.now()
    };
    for (const m of room.members.values()) send(m.ws, msg);
  }
};
function send(ws, msg) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
  }
}
__name(send, "send");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-4LBeTS/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-4LBeTS/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Arena,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
