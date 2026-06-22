import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { trackerToColumns } from "@/lib/tracker";
import { emptyTracker, TrackerData, HistoryMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SaveBody {
  sessionId: string;
  dbRowId: string | null;
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

  const { sessionId, dbRowId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const tracker = body.tracker ?? emptyTracker();
  const history = body.history ?? [];
  // Persist the transcript with neutral role labels (bot -> assistant).
  const rawConversation = history.map((m) => ({
    role: m.role === "bot" ? "assistant" : "user",
    content: m.content,
  }));

  const now = new Date();
  const columns = {
    ...trackerToColumns(tracker),
    raw_conversation: rawConversation,
  };

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[/api/save] supabase init:", err);
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  try {
    if (!dbRowId) {
      const insertRow = {
        session_id: sessionId,
        conversation_date: now.toISOString().slice(0, 10),
        conversation_time: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        conversation_location: "Virtual / Remote",
        ...columns,
      };
      const { data, error } = await supabase
        .from("interviews")
        .insert(insertRow)
        .select("id")
        .single();
      if (error) throw error;
      return NextResponse.json({ id: data.id });
    }

    const { error } = await supabase
      .from("interviews")
      .update(columns)
      .eq("id", dbRowId);
    if (error) throw error;
    return NextResponse.json({ id: dbRowId });
  } catch (err) {
    console.error("[/api/save] write error:", err);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
