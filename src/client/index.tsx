import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router";
import { usePartySocket } from "partysocket/react";
import { nanoid } from "nanoid";
import type { ChatMessage, Message, Room } from "../shared";

function saved(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preferences still work for this visit */
  }
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "something went wrong. try again.");
  return data as T;
}
function Brand() {
  const [animating, setAnimating] = useState(true);

  return (
    <Link
      to="/"
      className={`brand${animating ? " brand-animating" : ""}`}
      aria-label="shat. home"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setAnimating(true);
      }}
    >
      <span className="brand-word" aria-hidden="true">
        sh
        <span
          className="brand-expansion"
          onAnimationEnd={() => setAnimating(false)}
        >
          <span>(antry)</span>
        </span>
        at<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}

function App() {
  const [name, setName] = useState(() => saved("shat.name", ""));
  const [draftName, setDraftName] = useState(name);
  const [settings, setSettings] = useState(false);
  const [theme, setTheme] = useState(() =>
    saved(
      "shat.theme",
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    ),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save("shat.theme", theme);
  }, [theme]);
  return (
    <div className="shell">
      <header className="topbar">
        <Brand />
        <div className="header-actions">
          <button
            className="quiet"
            onClick={() => {
              setDraftName(name);
              setSettings(!settings);
            }}
          >
            {name ? `◉ ${name}` : "◉ set your name"}
          </button>
          <button
            className="theme-button"
            aria-label={`switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>
      {settings && (
        <form
          className="settings panel"
          onSubmit={(e) => {
            e.preventDefault();
            const next = draftName.trim().toLowerCase();
            if (next) {
              setName(next);
              save("shat.name", next);
              setSettings(false);
            }
          }}
        >
          <label htmlFor="display-name">what should we call you?</label>
          <div className="inline">
            <input
              id="display-name"
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="your display name"
              required
              maxLength={32}
            />
            <button className="primary">save name</button>
          </div>
          <small>saved on this browser. you can change it anytime.</small>
        </form>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/room/:room"
            element={
              <RoomPage
                name={name}
                setName={() => {
                  setDraftName(name);
                  setSettings(true);
                }}
              />
            }
          />
          <Route path="/:room" element={<LegacyRoom />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer>
        <span>shat. — just say something.</span>
      </footer>
    </div>
  );
}
function LegacyRoom() {
  const { room } = useParams();
  return <Navigate to={`/room/${room}`} replace />;
}
function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [invite, setInvite] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api<Room[]>("/api/rooms")
        .then((data) => {
          if (active) {
            setRooms(data);
            setListError("");
          }
        })
        .catch(() => {
          if (active)
            setListError("couldn’t load rooms. trying again shortly.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const filtered = rooms.filter((room) =>
    room.name.includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          <span className="dot" /> less scrolling. more talking.
        </div>
        <h1>
          take a shit in the
          <br />
          <span><strong>shat.</strong></span>
        </h1>
        <p>
          find your people, start a conversation, or make a little
          <br className="desktop" /> corner of the internet your own.
        </p>
        <div className="hero-doodle" aria-hidden="true">
          <div className="bubble bubble-one">
            i shit in the shat.<span>✳</span>
          </div>
          <div className="bubble bubble-two">yo me too</div>
          <span className="spark">✳</span>
        </div>
      </section>
      <div className="home-grid">
        <section className="directory">
          <div className="section-title">
            <h2>
              the rooms <span className="count">{rooms.length}</span>
            </h2>
            <span className="live">
              <span className="dot" /> open to everyone
            </span>
          </div>
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="find a room"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="find your kind of conversation..."
            />
          </label>
          {listError && (
            <p className="error" role="alert">
              {listError}
            </p>
          )}
          {loading ? (
            <div className="empty">pulling up a toilet...</div>
          ) : filtered.length ? (
            <div className="room-list">
              {filtered.map((room, i) => (
                <Link
                  className="room-card"
                  key={room.id}
                  to={`/room/${room.id}`}
                >
                  <span className={`room-icon tint-${i % 3}`}>#</span>
                  <div>
                    <h3>{room.name}</h3>
                    <p>public bathroom · come on in</p>
                  </div>
                  <span className="arrow">↗</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">
              <span className="empty-icon">✳</span>
              <h3>{search ? "no rooms found" : "a little quiet in here."}</h3>
              <p>
                {search
                  ? "try another search, or start a new room."
                  : "be the first to make a room. good conversations start somewhere."}
              </p>
            </div>
          )}
          <p className="directory-note">
            a shared space, a new perspective. pick a bathroom and say hello.
          </p>
        </section>
        <aside>
          <form
            className="panel create-panel"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const room = await api<Room>("/api/rooms", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: roomName,
                    private: privateRoom,
                  }),
                });
                navigate(`/room/${room.id}`);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <span className="eyebrow">your people. your place.</span>
            <h2>make some room.</h2>
            <p>big ideas, small talk, or absolutely nothing in particular.</p>
            <label htmlFor="room-name">room name</label>
            <input
              id="room-name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. the late night club"
              maxLength={60}
              required
              pattern=".*\S.*"
            />
            <label className="privacy">
              <span>
                <strong>keep it private</strong>
                <small>only people with the link or id can join.</small>
              </span>
              <input
                type="checkbox"
                checked={privateRoom}
                onChange={(e) => setPrivateRoom(e.target.checked)}
              />
            </label>
            <button
              className="primary full"
              disabled={busy || !roomName.trim()}
            >
              {busy ? "making room..." : "create a room"}
              <span>↗</span>
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
          <form
            className="join-panel"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const value = invite.trim();
                const id = value.includes("/")
                  ? new URL(value, location.origin).pathname
                      .split("/")
                      .filter(Boolean)
                      .pop()
                  : value;
                if (!id || !/^[\w-]{1,128}$/.test(id)) throw new Error();
                navigate(`/room/${id}`);
              } catch {
                setError("paste a valid bathroom link or id.");
              }
            }}
          >
            <h3>got an invite?</h3>
            <p>there’s a seat with your name on it.</p>
            <div className="inline">
              <input
                aria-label="room link or id"
                placeholder="paste a bathroom link or id"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                required
              />
              <button className="join-button" aria-label="join room">
                →
              </button>
            </div>
          </form>
        </aside>
      </div>
    </>
  );
}
function RoomPage({ name, setName }: { name: string; setName: () => void }) {
  const { room = "" } = useParams();
  const [info, setInfo] = useState<Room | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setInfo(null);
    setError("");
    api<Room>(`/api/rooms/${encodeURIComponent(room)}`)
      .then((data) => {
        if (active) setInfo(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [room]);
  if (error)
    return (
      <section className="empty">
        <h1>lost your room?</h1>
        <p role="alert">{error}</p>
        <Link to="/">← back to all rooms</Link>
      </section>
    );
  if (!info) return <p className="empty">finding your room...</p>;
  return (
    <Conversation key={info.id} room={info} name={name} setName={setName} />
  );
}
function Conversation({
  room,
  name,
  setName,
}: {
  room: Room;
  name: string;
  setName: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const socket = usePartySocket({
    party: "chat",
    room: room.id,
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
    onError: () => setConnected(false),
    onMessage: (event) => {
      try {
        const message = JSON.parse(event.data as string) as Message;
        if (message.type === "all") setMessages(message.messages);
        if (message.type === "add")
          setMessages((previous) =>
            previous.some((item) => item.id === message.id)
              ? previous
              : [...previous, message],
          );
        if (message.type === "error") setError(message.error);
      } catch {
        setError("couldn’t read a message. please reconnect.");
      }
    },
  });
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  const copy = async (idOnly: boolean) => {
    try {
      await navigator.clipboard.writeText(
        idOnly ? room.id : `${location.origin}/room/${room.id}`,
      );
      setCopied(idOnly ? "id copied" : "link copied");
    } catch {
      setCopied("copy the bathroom id below to share");
    }
  };
  return (
    <section className="conversation">
      <Link className="back" to="/">
        ← all rooms
      </Link>
      <div className="chat-heading">
        <div>
          <span className="eyebrow">
            {room.private
              ? "private · invite only"
              : "public · everyone’s welcome"}
          </span>
          <h1>{room.name}</h1>
        </div>
        <div className="share-actions">
          <button className="quiet" onClick={() => copy(false)}>
            copy invite link ↗
          </button>
          <button className="quiet" onClick={() => copy(true)}>
            copy id
          </button>
        </div>
      </div>
      <div className="room-meta">
        <span className="live">
          <span className={`dot ${connected ? "" : "offline"}`} />
          {connected ? "connected" : "connecting..."}
        </span>
        <span className="room-id">room id: {room.id}</span>
        <span role="status">{copied}</span>
      </div>
      <div className="chat-panel">
        <div
          className="messages"
          role="log"
          aria-label="room messages"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="empty">
              <span className="empty-icon">✳</span>
              <h2>you’re in good company.</h2>
              <p>start with a shit. see where it goes.</p>
            </div>
          )}
          {messages.map((message) => (
            <article className="message" key={message.id}>
              <div className="avatar">{message.user.slice(0, 1)}</div>
              <div>
                <strong>{message.user}</strong>
                <p>{message.content}</p>
              </div>
            </article>
          ))}
          <div ref={end} />
        </div>
        {!name ? (
          <div className="name-prompt">
            <p>one small thing before you say hello.</p>
            <button className="primary" onClick={setName}>
              set your name →
            </button>
          </div>
        ) : (
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              if (!content.trim() || !connected) return;
              try {
                socket.send(
                  JSON.stringify({
                    type: "add",
                    id: nanoid(),
                    user: name,
                    content: content.trim(),
                    role: "user",
                  } satisfies Message),
                );
                setContent("");
                setError("");
              } catch {
                setError("connection lost. try again when connected.");
              }
            }}
          >
            <label className="sr-only" htmlFor="message">
              your message
            </label>
            <input
              id="message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`say something, ${name}...`}
              maxLength={4000}
              autoComplete="off"
            />
            <button
              className="primary"
              disabled={!connected || !content.trim()}
            >
              send ↗
            </button>
          </form>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="directory-note">
        {room.private
          ? "this bathroom is unlisted. anyone with the invite can join and read its history."
          : "keep it kind. there’s a person on the other side."}
      </p>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
