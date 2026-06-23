"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatWindow from "@/components/interview/ChatWindow";
import InputBar from "@/components/interview/InputBar";
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
  const [hydrated, setHydrated] = useState(false);
  const [completed, setCompleted] = useState(false);

  const dbRowIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string>("");
  // Always holds the latest tracker + transcript so the on-exit flush can save
  // the final turn even if the debounce timer hasn't fired yet.
  const latestRef = useRef<{ tracker: TrackerData; history: HistoryMessage[] }>({
    tracker: emptyTracker(),
    history: [],
  });

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

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
    // Once an interview is complete we clear local state so the next person
    // starts fresh — don't re-persist it.
    if (!hydrated || !sessionId || completed) return;
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
  }, [hydrated, sessionId, messages, history, tracker, completed]);

  // ── Save to Supabase (idempotent upsert on session_id) ──────────────────
  const persistToDb = useCallback(
    async (trackerSnapshot: TrackerData, historySnapshot: HistoryMessage[]) => {
      if (!sessionId) return;
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
      } catch (err) {
        console.error("save failed:", err);
      }
    },
    [sessionId]
  );

  const scheduleSave = useCallback(
    (trackerSnapshot: TrackerData, historySnapshot: HistoryMessage[]) => {
      latestRef.current = { tracker: trackerSnapshot, history: historySnapshot };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistToDb(trackerSnapshot, historySnapshot);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistToDb]
  );

  // ── Flush-on-exit: guarantee the final turn (e.g. Sri's closing message) is
  //    saved even if the user closes/hides the tab before the debounce fires.
  useEffect(() => {
    const flush = () => {
      const sid = sessionIdRef.current;
      const { tracker: t, history: h } = latestRef.current;
      if (!sid || h.length === 0) return;
      try {
        const blob = new Blob(
          [JSON.stringify({ sessionId: sid, dbRowId: dbRowIdRef.current, tracker: t, history: h })],
          { type: "application/json" }
        );
        navigator.sendBeacon("/api/save", blob);
      } catch {
        /* best-effort on unload */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

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
        let isComplete = false;
        try {
          const parsed = JSON.parse(frameBuf || "{}");
          if (parsed.trackerUpdate) trackerUpdate = parsed.trackerUpdate;
          if (parsed.complete === true && parsed.error !== true) isComplete = true;
        } catch {
          /* no/invalid frame — keep empty delta */
        }

        const mergedTracker = mergeTracker(tracker, trackerUpdate);
        const finalHistory: HistoryMessage[] = [...nextHistory, { role: "bot", content: prose }];
        setTracker(mergedTracker);
        setHistory(finalHistory);

        if (isComplete) {
          // Interview wrapped up: save immediately (no debounce), clear local
          // state so the next person starts fresh, and show the done screen.
          if (saveTimer.current) clearTimeout(saveTimer.current);
          await persistToDb(mergedTracker, finalHistory);
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setCompleted(true);
        } else {
          // Debounced auto-save after the reply settles.
          scheduleSave(mergedTracker, finalHistory);
        }
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
    [isBusy, sessionId, history, tracker, scheduleSave, persistToDb]
  );

  // Wipe the conversation and start a brand-new interview for the next person.
  const resetSession = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dbRowIdRef.current = null;
    latestRef.current = { tracker: emptyTracker(), history: [] };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCompleted(false);
    setTracker(emptyTracker());
    setHistory([]);
    setSessionId(newId());
    setMessages([openingMessage()]);
  };

  // Clean, interviewee-facing chat. The Activity Tracker is intentionally NOT
  // rendered here — insights are still extracted and auto-saved in the
  // background and are visible only in the password-protected /admin dashboard.
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-off-white">
      <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
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

      {completed ? (
        <div className="border-t border-border bg-off-white px-6 py-6">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-7 text-center shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2FA866]/15 text-2xl">
              ✓
            </div>
            <div>
              <p className="text-[15px] font-semibold text-txt">
                Interview complete — thank you!
              </p>
              <p className="mt-1 text-sm text-txt-soft">
                Your responses have been saved. You can close this tab now.
              </p>
            </div>
            <button
              onClick={resetSession}
              className="mt-1 rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-steel"
            >
              Start a new interview
            </button>
          </div>
        </div>
      ) : (
        <InputBar onSend={sendMessage} disabled={isBusy} />
      )}
    </main>
  );
}
