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
    gemini_key: !!process.env.GEMINI_API_KEY,
    gemini_model: process.env.GEMINI_MODEL || "(default) gemini-2.0-flash",
    openrouter_key: !!process.env.OPENROUTER_API_KEY,
    openrouter_model: process.env.OPENROUTER_MODEL || "(default chain)",
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    admin_password: !!process.env.ADMIN_PASSWORD,
    // first provider the chat route will attempt
    primary_provider: process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.OPENROUTER_API_KEY
        ? "openrouter"
        : "none",
  });
}
