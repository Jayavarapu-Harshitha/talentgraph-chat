# TalentGraph

An AI-powered HR research interview tool for studying the **Visibility Gap** in
enterprise talent management. It has two surfaces:

- **`/`** — a public AI interview chat. "Sri", a peer-level grad-student research
  persona, conducts qualitative interviews with HR/talent leaders, extracts
  structured insights into a live sidebar tracker, and auto-saves each session.
- **`/admin`** — a password-protected dashboard to browse, search, and export all
  interview sessions to a 4-sheet Excel workbook.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL) — interview storage
- **OpenRouter** (OpenAI-compatible API) for the LLM — default model
  `deepseek/deepseek-chat-v3-0324:free`
- SheetJS (`xlsx`) for Excel export
- Fonts: Inter (UI) + Lora (chat bubbles)

## Setup

1. **Install dependencies**

   ```bash
   cd talentgraph
   npm install
   ```

2. **Create the database.** In your Supabase project, open the SQL editor and run
   [`supabase/schema.sql`](supabase/schema.sql). It creates the `interviews`
   table, an `updated_at` trigger, and locks down RLS.

3. **Configure environment.** Copy the example and fill in real values:

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | Notes |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | **server-only** — all DB reads/writes use this |
   | `OPENROUTER_API_KEY` | **server-only** — never exposed to the browser |
   | `OPENROUTER_MODEL` | defaults to a free model (see note below) |
   | `ADMIN_PASSWORD` | gate for `/admin` (default `research2026`) |

4. **Run it**

   ```bash
   npm run dev
   ```

   Interview chat → http://localhost:3000 · Admin → http://localhost:3000/admin

## Model strategy (reliable on free tier)

`/api/chat` tries LLM providers in order and only shows an error if **all** fail:

1. **Google Gemini free tier** (primary) — set `GEMINI_API_KEY` from
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The free tier
   gives a **dedicated per-key quota (~1,500 req/day, 15/min)** on
   `gemini-2.0-flash`, so it does **not** random-429 the way shared free pools do.
   This is what keeps the chat stable for free.
2. **OpenRouter free models** (fallback chain) — `OPENROUTER_MODEL` is a
   comma-separated list (Llama 3.3 70B → Qwen3 → Gemini Flash exp → …). Used only
   if Gemini is unavailable. Free OpenRouter models share a global pool and 429
   frequently with no credit balance — that's why Gemini is primary.

Set either or both. With at least `GEMINI_API_KEY`, the "connection issue"
message effectively disappears. For top quality, add OpenRouter credit and set
`OPENROUTER_MODEL` to a paid slug like `anthropic/claude-sonnet-4.6`.

## How it works

- **Chat / tracker** — `/api/chat` calls OpenRouter with `stream: true`. Sri's
  reply is streamed token-by-token; a hidden `[[TRACKER:…TRACKER]]` JSON block is
  appended to every reply, detected at the marker boundary server-side, stripped
  from the visible text, and returned as a final control frame. The client merges
  it into the sidebar tracker with case-insensitive dedup.
- **Auto-save** — 2s after each reply settles, the client POSTs to `/api/save`,
  which INSERTs (first time) then PATCHes by row id using the Supabase
  service-role key.
- **Session resume** — the active session (messages, history, tracker, row id) is
  mirrored to `localStorage`, so a refresh continues the same interview.
- **Admin** — the password is checked client-side then validated server-side via
  the `x-admin-password` header on `/api/sessions`. This is lightweight gating
  suitable for a low-sensitivity research tool, not hardened auth.

## Security

`OPENROUTER_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are only ever read inside
`/app/api/**` route handlers and are never imported into client components.
