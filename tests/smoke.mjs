import assert from "node:assert/strict";
import WebSocket from "ws";
const base = process.env.TEST_URL || "http://localhost:8787";
const create = async (name, privateRoom) => {
  const response = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, private: privateRoom }),
  });
  assert.equal(response.status, 201);
  return response.json();
};
const publicRoom = await create("the Reader's Room", false);
const privateRoom = await create("private smoke test", true);
const list = await (await fetch(`${base}/api/rooms`)).json();
assert(list.some((room) => room.id === publicRoom.id));
assert(!list.some((room) => room.id === privateRoom.id));
assert.equal(publicRoom.name, "the reader's room");
assert.equal((await fetch(`${base}/api/rooms/${privateRoom.id}`)).status, 200);
assert.equal((await fetch(`${base}/api/rooms/does-not-exist`)).status, 404);
assert.equal(
  (await fetch(`${base}/api/rooms`, { method: "POST", body: "{" })).status,
  400,
);
assert.equal((await fetch(`${base}/room/${privateRoom.id}`)).status, 200);
function connect(id) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `${base.replace(/^http/, "ws")}/parties/chat/${id}`,
    );
    socket.once("error", reject);
    socket.once("message", (data) =>
      resolve({ socket, history: JSON.parse(data) }),
    );
  });
}
function next(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("message timed out")),
      5000,
    );
    socket.once("message", (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data));
    });
  });
}
const a = await connect(privateRoom.id);
const b = await connect(privateRoom.id);
assert.equal(a.history.type, "all");
const id = crypto.randomUUID();
const receivedA = next(a.socket),
  receivedB = next(b.socket);
a.socket.send(
  JSON.stringify({
    type: "add",
    id,
    user: "O'BRIEN",
    content: 'Hello "world"; it\'s working',
    role: "user",
  }),
);
assert.equal((await receivedA).content, 'hello "world"; it\'s working');
assert.equal((await receivedB).user, "o'brien");
const invalid = next(a.socket);
a.socket.send("not json");
assert.equal((await invalid).type, "error");
const duplicate = next(a.socket);
a.socket.send(
  JSON.stringify({
    type: "add",
    id,
    user: "intruder",
    content: "replacement",
    role: "user",
  }),
);
assert.equal((await duplicate).user, "o'brien");
a.socket.terminate();
b.socket.terminate();
const c = await connect(privateRoom.id);
assert.equal(c.history.messages.length, 1);
assert.equal(c.history.messages[0].content, 'hello "world"; it\'s working');
c.socket.terminate();
const other = await connect(publicRoom.id);
assert.equal(other.history.messages.length, 0);
other.socket.terminate();
console.log(
  "passed: public/private visibility, invite lookup, validation, deep links, two-client broadcast, quotes, duplicate protection, reconnect history, room isolation",
);
