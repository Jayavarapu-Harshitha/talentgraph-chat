import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live provider diagnostic: makes a minimal 1-token call to each configured LLM
 * provider and reports success or the actual error (status + message), so we can
 * see exactly why a provider (e.g. Gemini) is failing. Returns no secret values.
 */
async function probe(
  label: string,
  baseURL: string,
  apiKey: string | undefined,
  model: string,
  headers?: Record<string, string>
) {
  if (!apiKey) return { label, model, ok: false, error: "no api key set" };
  try {
    const client = new OpenAI({ apiKey, baseURL, defaultHeaders: headers, maxRetries: 0 });
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      max_tokens: 5,
      temperature: 0,
    });
    return { label, model, ok: true, sample: r.choices?.[0]?.message?.content ?? "" };
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);
    return { label, model, ok: false, status, error: message.slice(0, 400) };
  }
}

/** Native Gemini call — returns the FULL Google error body (the OpenAI-compat
 *  layer hides it), revealing the real reason for a 429 (quota / region / etc.). */
async function probeGeminiNative() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  if (!key) return { label: "gemini-native", ok: false, error: "no api key set" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Reply: ok" }] }] }),
      }
    );
    const text = await res.text();
    return { label: "gemini-native", model, status: res.status, ok: res.ok, body: text.slice(0, 600) };
  } catch (err) {
    return { label: "gemini-native", model, ok: false, error: String(err).slice(0, 300) };
  }
}

export async function GET() {
  const results = [];

  results.push(
    await probe(
      "groq",
      "https://api.groq.com/openai/v1",
      process.env.GROQ_API_KEY,
      (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").split(",")[0].trim()
    )
  );

  results.push(await probeGeminiNative());

  results.push(
    await probe(
      "gemini",
      "https://generativelanguage.googleapis.com/v1beta/openai/",
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_MODEL || "gemini-2.0-flash"
    )
  );

  const orModel = (process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free")
    .split(",")[0]
    .trim();
  results.push(
    await probe(
      "openrouter",
      "https://openrouter.ai/api/v1",
      process.env.OPENROUTER_API_KEY,
      orModel,
      {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "TalentGraph",
      }
    )
  );

  return NextResponse.json({ results });
}
