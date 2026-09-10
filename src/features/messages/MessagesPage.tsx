import { useEffect, useState } from "react";
import { ArrowLeft, Search, Send } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { useAuth } from "../../lib/AppProviders";
import { employeeUser } from "../../data/session";
import { messagesApi } from "../../api/messages";
import type { ChatMessage, Conversation } from "../../data/messages";

/** Messages (Employee board 39): channel/DM rail + conversation thread. */
export function MessagesPage() {
  const { variant } = useOutletContext<{ variant: "desktop" | "mobile" }>();
  const { session } = useAuth();
  const me = session ?? employeeUser;
  const [list, setList] = useState<Conversation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("");
  const [thread, setThread] = useState<ChatMessage[] | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [draft, setDraft] = useState("");

  const load = async () => {
    setLoadError(null);
    try {
      const conversations = await messagesApi.conversations();
      setList(conversations);
      if (conversations.length > 0) {
        setActiveId((prev) => (prev && conversations.some((c) => c.id === prev) ? prev : conversations[0].id));
        // desktop shows the first conversation immediately; mobile waits for a tap
        if (variant === "desktop") {
          const first = conversations[0].id;
          setThread(null);
          try {
            const data = await messagesApi.open(first);
            setThread(data.messages);
            setList((prev) => (prev ?? []).map((c) => (c.id === first ? { ...c, unread: 0 } : c)));
            void messagesApi.markRead(first).catch(() => undefined);
          } catch (e2) {
            setThreadError(e2 instanceof Error ? e2.message : "Couldn't open this conversation");
          }
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load conversations");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (id: string) => {
    setActiveId(id);
    setMobileView("thread");
    setThread(null);
    setThreadError(null);
    try {
      const data = await messagesApi.open(id);
      setThread(data.messages);
      setList((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      void messagesApi.markRead(id).catch(() => undefined);
    } catch (e) {
      setThreadError(e instanceof Error ? e.message : "Couldn't open this conversation");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    setDraft("");
    const now = new Date();
    const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${now.getHours() >= 12 ? "PM" : "AM"}`;
    // optimistic append (rolls back if the send fails)
    setThread((prev) => [...(prev ?? []), { initials: me.initials, name: me.name, time, text, mine: true }]);
    setList((prev) => (prev ?? []).map((c) => (c.id === activeId ? { ...c, preview: `${me.name.split(" ")[0]}: ${text}` } : c)));
    try {
      await messagesApi.send({ conversationId: activeId, body: text });
    } catch {
      setThread((prev) => (prev ?? []).filter((m) => !(m.mine && m.text === text && m.time === time)));
    }
  };

  const channels = (list ?? []).filter(
    (c) => c.kind === "channel" && (c.name.toLowerCase().includes(query.trim().toLowerCase()) || c.preview.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const dms = (list ?? []).filter(
    (c) => c.kind === "dm" && (c.name.toLowerCase().includes(query.trim().toLowerCase()) || c.preview.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const active = (list ?? []).find((c) => c.id === activeId);

  const showList = variant === "mobile" ? mobileView === "list" : true;
  const showThread = variant === "mobile" ? mobileView === "thread" : true;

  return (
    <section className="page" style={{ padding: 0 }}>
      <div className={`messages-layout ${showList ? "rail-open" : ""}`.trim()}>
        {showList ? (
          <aside className="messages-rail" aria-label="Conversations">
            <div className="rail-search">
              <Search aria-hidden="true" />
              <input
                placeholder="Search messages"
                aria-label="Search messages"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ border: 0, outline: 0, background: "transparent", font: "inherit", color: "var(--ink)", width: "100%" }}
              />
            </div>

            {list === null && !loadError ? <LoadingBlock rows={5} card={false} /> : null}
            {loadError ? <ErrorBlock message={loadError} onRetry={() => void load()} /> : null}

            {list ? (
              <>
                <span className="rail-label">Channels</span>
                {channels.map((c) => (
                  <RailItem key={c.id} c={c} active={c.id === activeId} onOpen={() => void open(c.id)} showHash />
                ))}
                <span className="rail-label">Direct Messages</span>
                {dms.map((c) => (
                  <RailItem key={c.id} c={c} active={c.id === activeId} onOpen={() => void open(c.id)} />
                ))}
              </>
            ) : null}
          </aside>
        ) : null}

        {showThread ? (
          <section className="thread" aria-label={active?.name ?? "Messages"}>
            <header className="thread-head">
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {variant === "mobile" ? (
                  <button type="button" className="icon-btn-flat" aria-label="Back to conversations" onClick={() => setMobileView("list")} style={{ marginLeft: -8 }}>
                    <ArrowLeft aria-hidden="true" />
                  </button>
                ) : null}
                <span style={{ minWidth: 0 }}>
                  <h2 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {active ? (active.kind === "channel" ? `# ${active.name}` : active.name) : ""}
                  </h2>
                  <span className="members">{active?.members ?? ""}</span>
                </span>
              </span>
            </header>

            <div className="thread-body">
              {threadError ? <ErrorBlock message={threadError} onRetry={() => void open(activeId)} /> : null}
              {!thread && !threadError ? (
                <div style={{ padding: 16 }}>
                  <LoadingBlock rows={3} />
                </div>
              ) : null}
              {thread?.map((msg, i) => (
                <div className="msg" key={i}>
                  <span className="avatar avatar--sm" style={{ background: msg.mine ? me.color : msg.initials === "SJ" ? "#2E86AB" : "#1F3C88" }}>
                    {msg.initials}
                  </span>
                  <span className="bubble">
                    <span className="who">
                      {msg.name}
                      <span className="time">{msg.time}</span>
                    </span>
                    <br />
                    <span className="txt">{msg.text}</span>
                  </span>
                </div>
              ))}
              {thread && thread.length === 0 ? <span className="cell-muted" style={{ padding: 16, display: "block" }}>No messages yet — say hello.</span> : null}
            </div>

            <footer className="thread-input">
              <input
                className="field-input"
                placeholder={active ? `Message ${active.kind === "channel" ? `#${active.name}` : active.name}` : "Message"}
                aria-label="Message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button type="button" className="send-btn" aria-label="Send message" onClick={() => void send()}>
                <Send aria-hidden="true" />
              </button>
            </footer>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function RailItem({ c, active, onOpen, showHash }: { c: Conversation; active: boolean; onOpen: () => void; showHash?: boolean }) {
  return (
    <button type="button" className={`rail-item ${active ? "active" : ""}`.trim()} onClick={onOpen}>
      <span className="avatar avatar--sm" style={{ background: c.color, width: 28, height: 28, fontSize: 11 }}>{c.glyph}</span>
      <span className="meta">
        <span className="nm">{showHash ? `# ${c.name}` : c.name}</span>
        <span className="pv">{c.preview || "No messages yet"}</span>
      </span>
      {c.unread > 0 ? <span className="unread-pill">{c.unread}</span> : null}
    </button>
  );
}
