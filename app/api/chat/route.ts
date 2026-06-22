import OpenAI from "openai";
import { buildSystemPrompt, TRACKER_OPEN } from "@/lib/systemPrompt";
import { splitReplyAndTracker } from "@/lib/tracker";
import { emptyTracker, TrackerData, HistoryMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow long-running LLM streams (Vercel default is short; Hobby caps at 60s).
export const maxDuration = 60;

/** Record-separator: divides streamed prose from the final tracker JSON frame.
 *  This byte never appears in natural-language prose, so the client can split safely. */
const SEP = "\x1e";

const FRIENDLY_ERROR =
  "I'm having a bit of a connection issue on my end — could you try sending that again?";

export async function POST(req: Request) {
  let body: { messages?: HistoryMessage[]; trackerState?: TrackerData };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const messages = body.messages ?? [];
  const trackerState: TrackerData = body.trackerState ?? emptyTracker();

  const apiKey = process.env.OPENROUTER_API_KEY;
  const encoder = new TextEncoder();

  if (!apiKey) {
    const frame =
      FRIENDLY_ERROR +
      SEP +
      JSON.stringify({ trackerUpdate: emptyTracker(), error: true });
    return new Response(frame, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_SITE_NAME ?? "TalentGraph",
    },
  });

  const model =
    process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

  const apiMessages = [
    { role: "system" as const, content: buildSystemPrompt(trackerState) },
    ...messages.map((m) => ({
      role: (m.role === "bot" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    })),
  ];

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      let emitted = 0;
      let markerFound = false;

      try {
        const completion = await client.chat.completions.create({
          model,
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 1024,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (!delta) continue;
          full += delta;
          if (markerFound) continue;

          const idx = full.indexOf(TRACKER_OPEN);
          if (idx !== -1) {
            markerFound = true;
            if (idx > emitted) {
              controller.enqueue(encoder.encode(full.slice(emitted, idx)));
              emitted = idx;
            }
          } else {
            // Hold back the last (marker length - 1) chars in case the marker is
            // split across deltas; only emit what is definitely prose.
            const safe = full.length - (TRACKER_OPEN.length - 1);
            if (safe > emitted) {
              controller.enqueue(encoder.encode(full.slice(emitted, safe)));
              emitted = safe;
            }
          }
        }

        if (!markerFound && full.length > emitted) {
          controller.enqueue(encoder.encode(full.slice(emitted)));
        }

        const { tracker } = splitReplyAndTracker(full);
        controller.enqueue(
          encoder.encode(SEP + JSON.stringify({ trackerUpdate: tracker }))
        );
      } catch (err) {
        console.error("[/api/chat] stream error:", err);
        // If nothing was shown yet, surface the friendly message; otherwise just
        // close the prose and send an (empty) tracker frame flagged as an error.
        if (emitted === 0 && !markerFound) {
          controller.enqueue(encoder.encode(FRIENDLY_ERROR));
        }
        controller.enqueue(
          encoder.encode(
            SEP + JSON.stringify({ trackerUpdate: emptyTracker(), error: true })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
