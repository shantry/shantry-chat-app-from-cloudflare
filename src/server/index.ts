import { DurableObject } from "cloudflare:workers";
import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";
import type { ChatMessage, Message, Room } from "../shared";

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

// A single persistent directory holds metadata; each conversation still has its own object.
export class RoomDirectory extends DurableObject<Env> {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        const room = await this.ctx.storage.get<Room>(`room:${id}`);
        return room
          ? json(room)
          : json(
              { error: "room not found. check your invite and try again." },
              404,
            );
      }
      const rooms = await this.ctx.storage.list<Room>({ prefix: "room:" });
      return json(
        [...rooms.values()]
          .filter((room) => !room.private)
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    }
    if (request.method !== "POST")
      return json({ error: "method not allowed" }, 405);
    let body: { name?: unknown; private?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid request" }, 400);
    }
    if (
      !body ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 60 ||
      typeof body.private !== "boolean"
    ) {
      return json(
        { error: "choose a room name between 1 and 60 characters." },
        400,
      );
    }
    const room: Room = {
      id: crypto.randomUUID(),
      name: body.name.trim().toLowerCase(),
      private: body.private,
      createdAt: Date.now(),
    };
    await this.ctx.storage.put(`room:${room.id}`, room);
    return json(room, 201);
  }
}

export class Chat extends Server<Env> {
  static options = { hibernate: true };
  onStart() {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`,
    );
  }
  onConnect(connection: Connection) {
    const messages = this.ctx.storage.sql
      .exec<ChatMessage>(
        `SELECT id, user, role, content FROM (SELECT rowid, * FROM messages ORDER BY rowid DESC LIMIT 200) ORDER BY rowid`,
      )
      .toArray();
    connection.send(
      JSON.stringify({ type: "all", messages } satisfies Message),
    );
  }
  onMessage(connection: Connection, raw: WSMessage) {
    try {
      if (typeof raw !== "string" || raw.length > 20000) throw new Error();
      const value = JSON.parse(raw);
      if (
        !value ||
        value.type !== "add" ||
        typeof value.id !== "string" ||
        !/^[\w-]{1,64}$/.test(value.id) ||
        typeof value.user !== "string" ||
        !value.user.trim() ||
        value.user.trim().length > 32 ||
        typeof value.content !== "string" ||
        !value.content.trim() ||
        value.content.length > 4000
      )
        throw new Error();
      const message: ChatMessage = {
        id: value.id,
        user: value.user.trim().toLowerCase(),
        content: value.content.trim().toLowerCase(),
        role: "user",
      };
      // Bind values rather than interpolating user-controlled text into SQL.
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO messages (id, user, role, content) VALUES (?, ?, ?, ?)`,
        message.id,
        message.user,
        message.role,
        message.content,
      );
      const saved = this.ctx.storage.sql
        .exec<ChatMessage>(
          `SELECT id, user, role, content FROM messages WHERE id = ?`,
          message.id,
        )
        .one();
      this.broadcast(
        JSON.stringify({ type: "add", ...saved } satisfies Message),
      );
    } catch {
      connection.send(
        JSON.stringify({
          type: "error",
          error: "message could not be sent. use a name and 1–4000 characters.",
        } satisfies Message),
      );
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const directory = env.RoomDirectory.get(
      env.RoomDirectory.idFromName("rooms"),
    );
    if (url.pathname === "/api/rooms") return directory.fetch(request);
    const roomMatch = url.pathname.match(/^\/api\/rooms\/([\w-]+)$/);
    if (roomMatch && request.method === "GET")
      return directory.fetch(`https://directory/?id=${roomMatch[1]}`);
    const socketMatch = url.pathname.match(/^\/parties\/chat\/([\w-]+)$/);
    if (socketMatch) {
      const room = await directory.fetch(
        `https://directory/?id=${socketMatch[1]}`,
      );
      if (!room.ok) return room;
    } else if (
      url.pathname.startsWith("/parties/") ||
      url.pathname.startsWith("/api/")
    ) {
      return json({ error: "not found" }, 404);
    }
    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;
