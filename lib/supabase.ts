import { createClient } from "@supabase/supabase-js";

/**
 * Server-side admin client using the service-role key. Bypasses RLS.
 * NEVER import this into a client component — the service-role key must
 * stay server-side. It is only referenced inside /app/api/** route handlers.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js App Router caches fetch() by default, and supabase-js uses fetch
    // internally — which made /api/sessions serve stale rows. Force no-store so
    // every read/write hits the database fresh.
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
