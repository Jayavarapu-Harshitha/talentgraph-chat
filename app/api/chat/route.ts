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

interface ProviderAttempt {
  label: string;
  baseURL: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
}

/**
 * Ordered list of (provider, model) attempts. The route tries each in turn and
 * only surfaces an error if ALL fail. Primary is a DEDICATED free quota (Google
 * Gemini free tier — not a shared pool, so it doesn't random-429); OpenRouter
 * free models are the fallback chain behind it.
 */
function buildProviders(): ProviderAttempt[] {
  const providers: ProviderAttempt[] = [];

  // 1) Groq free tier (PRIMARY — dedicated per-key quota, reliable, fast).
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const models = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile,llama-3.1-8b-instant")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    for (const model of models) {
      providers.push({
        label: "groq",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: groqKey,
        model,
      });
    }
  }

  // 2) OpenRouter free models — fallback chain.
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    const defaultChain = [
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.2-3b-instruct:free",
    ].join(",");
    const models = (process.env.OPENROUTER_MODEL || defaultChain)
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    for (const model of models) {
      providers.push({
        label: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: orKey,
        model,
        headers: {
          "HTTP-Referer":
            process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_SITE_NAME ?? "TalentGraph",
        },
      });
    }
  }

  // 3) Google Gemini — LAST. Many accounts have a free-tier limit of 0 (no
  // quota unless Cloud billing is enabled), so it's a best-effort tail option.
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const models = (process.env.GEMINI_MODEL || "gemini-2.0-flash")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    for (const model of models) {
      providers.push({
        label: "gemini",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey: geminiKey,
        model,
      });
    }
  }

  return providers;
}

export async function POST(req: Request) {
  let body: { messages?: HistoryMessage[]; trackerState?: TrackerData };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const messages = body.messages ?? [];
  const trackerState: TrackerData = body.trackerState ?? emptyTracker();
  const encoder = new TextEncoder();
  const providers = buildProviders();

  const errorResponse = () =>
    new Response(
      FRIENDLY_ERROR +
        SEP +
        JSON.stringify({ trackerUpdate: emptyTracker(), error: true }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );

  if (providers.length === 0) return errorResponse();

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
      let succeeded = false;

      for (const provider of providers) {
        // Once we've shown any text to the user we can't switch providers
        // mid-stream, so stop trying alternatives.
        if (succeeded || emitted > 0) break;

        // Fresh attempt: reset the per-attempt accumulators.
        full = "";
        markerFound = false;

        try {
          const client = new OpenAI({
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
            defaultHeaders: provider.headers,
            maxRetries: 0,
          });

          const completion = await client.chat.completions.create({
            model: provider.model,
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
              // Hold back the last (marker length - 1) chars in case the marker
              // is split across deltas; only emit what is definitely prose.
              const safe = full.length - (TRACKER_OPEN.length - 1);
              if (safe > emitted) {
                controller.enqueue(encoder.encode(full.slice(emitted, safe)));
                emitted = safe;
              }
            }
          }

          // A provider that returned no content at all → try the next one.
          if (full.trim().length === 0) continue;

          if (!markerFound && full.length > emitted) {
            controller.enqueue(encoder.encode(full.slice(emitted)));
            emitted = full.length;
          }
          succeeded = true;
        } catch (err) {
          const status =
            err && typeof err === "object" && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          console.error(
            `[/api/chat] provider ${provider.label}/${provider.model} failed (status ${status})`
          );
          // If we already streamed partial prose, we can't cleanly switch.
          if (emitted > 0) break;
          // Otherwise fall through to the next provider.
        }
      }

      if (!succeeded && emitted === 0) {
        controller.enqueue(encoder.encode(FRIENDLY_ERROR));
      }

      const { tracker } = splitReplyAndTracker(full);
      controller.enqueue(
        encoder.encode(
          SEP +
            JSON.stringify({
              trackerUpdate: succeeded ? tracker : emptyTracker(),
              error: !succeeded,
            })
        )
      );
      controller.close();
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
