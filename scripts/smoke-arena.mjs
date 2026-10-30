// 手元の wrangler dev に2人で入り、ready で戦闘開始のメッセージが届くか確かめる
const URL = process.argv[2] ?? "ws://127.0.0.1:8787/ws";

function client(name, code) {
  const ws = new WebSocket(URL);
  const log = [];
  ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "join", name, code })));
  ws.addEventListener("message", (e) => log.push(JSON.parse(e.data)));
  return { ws, log };
}

const a = client("アリス\u0000", "STVB");
const b = client("ボブ", "WCGD");
await new Promise((r) => setTimeout(r, 4000));
a.ws.send(JSON.stringify({ type: "ready" }));
await new Promise((r) => setTimeout(r, 300));
b.ws.send(JSON.stringify({ type: "ready" }));
await new Promise((r) => setTimeout(r, 800));

const start = b.log.find((m) => m.type === "start");
const lobby = a.log.filter((m) => m.type === "lobby").at(-1);
console.log(JSON.stringify({ welcome: a.log[0], lobby, start }, null, 1));
a.ws.close();
b.ws.close();
process.exit(start && start.entrants.length === 2 ? 0 : 1);
