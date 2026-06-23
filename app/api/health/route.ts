import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight diagnostic: reports WHICH env vars the running deployment can see,
 * as booleans only — it never returns secret values. Used to verify that keys
 * (e.g. GEMINI_API_KEY) actually propagated to Vercel after a redeploy.
 */
export async function GET() {
  return NextResponse.json({
    groq_key: !!process.env.GROQ_API_KEY,
    groq_model: process.env.GROQ_MODEL || "(default) llama-3.3-70b-versatile",
    openrouter_key: !!process.env.OPENROUTER_API_KEY,
    openrouter_model: process.env.OPENROUTER_MODEL || "(default chain)",
    gemini_key: !!process.env.GEMINI_API_KEY,
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    admin_password: !!process.env.ADMIN_PASSWORD,
    // first provider the chat route will attempt
    primary_provider: process.env.GROQ_API_KEY
      ? "groq"
      : process.env.OPENROUTER_API_KEY
        ? "openrouter"
        : process.env.GEMINI_API_KEY
          ? "gemini"
          : "none",
  });
}
