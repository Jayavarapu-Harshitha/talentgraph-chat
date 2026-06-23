import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { trackerToColumns } from "@/lib/tracker";
import { emptyTracker, TrackerData, HistoryMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SaveBody {
  sessionId: string;
  dbRowId?: string | null;
  tracker: TrackerData;
  history: HistoryMessage[];
}

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const tracker = body.tracker ?? emptyTracker();
  const history = body.history ?? [];
  // Persist the full transcript with neutral role labels (bot -> assistant).
  const rawConversation = history.map((m) => ({
    role: m.role === "bot" ? "assistant" : "user",
    content: m.content,
  }));

  const now = new Date();
  const row = {
    session_id: sessionId,
    conversation_date: now.toISOString().slice(0, 10),
    conversation_time: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    conversation_location: "Virtual / Remote",
    ...trackerToColumns(tracker),
    raw_conversation: rawConversation,
    updated_at: now.toISOString(),
  };

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[/api/save] supabase init:", err);
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  // Upsert keyed on the unique session_id: idempotent, race-free, and always
  // writes the complete current tracker + transcript whether it's the first
  // save or the tenth. No dependency on insert-then-patch ordering.
  const { data, error } = await supabase
    .from("interviews")
    .upsert(row, { onConflict: "session_id" })
    .select("id")
    .single();

  if (error) {
    console.error("[/api/save] upsert error:", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
