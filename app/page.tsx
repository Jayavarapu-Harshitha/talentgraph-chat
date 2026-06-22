"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatWindow from "@/components/interview/ChatWindow";
import InputBar from "@/components/interview/InputBar";
import ActivitySidebar, { SaveStatus } from "@/components/tracker/ActivitySidebar";
import { Message, TrackerData, HistoryMessage, emptyTracker } from "@/lib/types";
import { mergeTracker } from "@/lib/tracker";
import { OPENING_MESSAGE } from "@/lib/systemPrompt";

const SEP = "\x1e";
const STORAGE_KEY = "talentgraph:session";
const SAVE_DEBOUNCE_MS = 2000;

interface PersistShape {
  sessionId: string;
  dbRowId: string | null;
  messages: { id: string; role: "bot" | "user"; content: string; timestamp: string }[];
  history: HistoryMessage[];
  tracker: TrackerData;
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function openingMessage(): Message {
  return { id: newId(), role: "bot", content: OPENING_MESSAGE, timestamp: new Date() };
}

export default function InterviewPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [tracker, setTracker] = useState<TrackerData>(emptyTracker());
  const [sessionId, setSessionId] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const dbRowIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = new Date();

  // ── Mount: restore from localStorage or start a fresh interview ──────────
  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: PersistShape = JSON.parse(raw);
        if (saved.sessionId && saved.messages?.length) {
          setSessionId(saved.sessionId);
          dbRowIdRef.current = saved.dbRowId ?? null;
          setMessages(
            saved.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
          );
          setHistory(saved.history ?? []);
          setTracker(saved.tracker ?? emptyTracker());
          if (saved.dbRowId) setSaveStatus("saved");
          restored = true;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    if (!restored) {
      setSessionId(newId());
      setMessages([openingMessage()]);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist to localStorage on every meaningful change ──────────────────
  useEffect(() => {
    if (!hydrated || !sessionId) return;
    const payload: PersistShape = {
      sessionId,
      dbRowId: dbRowIdRef.current,
      messages: messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })),
      history,
      tracker,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [hydrated, sessionId, messages, history, tracker]);

  // ── Save to Supabase (INSERT then PATCH) ────────────────────────────────
  const persistToDb = useCallback(
    async (trackerSnapshot: TrackerData, historySnapshot: HistoryMessage[]) => {
      if (!sessionId) return;
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            dbRowId: dbRowIdRef.current,
            tracker: trackerSnapshot,
            history: historySnapshot,
          }),
        });
        if (!res.ok) throw new Error(`save ${res.status}`);
        const data = await res.json();
        if (data.id) dbRowIdRef.current = data.id;
        setSaveStatus("saved");
      } catch (err) {
        console.error("save failed:", err);
        setSaveStatus("error");
      }
    },
    [sessionId]
  );

  const scheduleSave = useCallback(
    (trackerSnapshot: TrackerData, historySnapshot: HistoryMessage[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistToDb(trackerSnapshot, historySnapshot);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistToDb]
  );

  // ── Send a message + stream the reply ───────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (isBusy || !sessionId) return;

      const userMsg: Message = { id: newId(), role: "user", content: text, timestamp: new Date() };
      const botId = newId();
      const nextHistory: HistoryMessage[] = [...history, { role: "user", content: text }];

      setMessages((prev) => [...prev, userMsg]);
      setHistory(nextHistory);
      setIsBusy(true);
      setShowTyping(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextHistory, trackerState: tracker }),
        });
        if (!res.body) throw new Error("no stream body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let prose = "";
        let frameBuf = "";
        let inFrame = false;
        let firstToken = true;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          for (const ch of chunk) {
            if (inFrame) {
              frameBuf += ch;
              continue;
            }
            if (ch === SEP) {
              inFrame = true;
              continue;
            }
            prose += ch;
          }

          if (firstToken && prose.length > 0) {
            firstToken = false;
            setShowTyping(false);
            setMessages((prev) => [
              ...prev,
              { id: botId, role: "bot", content: prose, timestamp: new Date() },
            ]);
          } else if (!firstToken) {
            setMessages((prev) =>
              prev.map((m) => (m.id === botId ? { ...m, content: prose } : m))
            );
          }
        }

        // Edge: empty prose (e.g. immediate error frame) — still show a bubble.
        if (firstToken) {
          setShowTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: botId,
              role: "bot",
              content:
                prose ||
                "I'm having a bit of a connection issue on my end — could you try sending that again?",
              timestamp: new Date(),
            },
          ]);
        }

        let trackerUpdate: TrackerData = emptyTracker();
        try {
          const parsed = JSON.parse(frameBuf || "{}");
          if (parsed.trackerUpdate) trackerUpdate = parsed.trackerUpdate;
        } catch {
          /* no/invalid frame — keep empty delta */
        }

        const mergedTracker = mergeTracker(tracker, trackerUpdate);
        const finalHistory: HistoryMessage[] = [...nextHistory, { role: "bot", content: prose }];
        setTracker(mergedTracker);
        setHistory(finalHistory);

        // Debounced auto-save after the reply settles.
        scheduleSave(mergedTracker, finalHistory);
      } catch (err) {
        console.error("chat failed:", err);
        setShowTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "bot",
            content:
              "I'm having a bit of a connection issue on my end — could you try sending that again?",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, sessionId, history, tracker, scheduleSave]
  );

  const manualSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persistToDb(tracker, history);
  };

  const sidebar = (
    <ActivitySidebar
      tracker={tracker}
      saveStatus={saveStatus}
      dateLabel={now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      timeLabel={now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      onSave={manualSave}
      onCloseMobile={() => setSidebarOpen(false)}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="animate-slide-in">{sidebar}</div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Chat area */}
      <main className="flex min-w-0 flex-1 flex-col bg-off-white">
        <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-txt-mid md:hidden"
            aria-label="Open tracker"
          >
            ☰
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-off-white text-xl ring-1 ring-border">
            🎓
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-txt">
                Sri · Research Assistant
              </span>
              <span className="flex items-center gap-1 text-[11px] text-txt-soft">
                <span className="h-2 w-2 rounded-full bg-[#2FA866]" />
                online
              </span>
            </div>
            <p className="text-xs text-txt-soft">
              Talent Visibility Study · Graduate Research
            </p>
          </div>
        </header>

        <ChatWindow messages={messages} showTyping={showTyping} />
        <InputBar onSend={sendMessage} disabled={isBusy} />
      </main>
    </div>
  );
}
