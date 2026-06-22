-- ============================================================
-- TalentGraph — Supabase schema
-- Run this in the Supabase SQL editor (Project → SQL → New query).
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.interviews (
  id                    uuid primary key default gen_random_uuid(),
  session_id            text unique not null,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  conversation_date     date,
  conversation_time     text,
  conversation_location text default 'Virtual / Remote',
  interviewee_name      text,
  company               text,
  role                  text,
  archetype             text,
  pain_points           text[] default '{}',
  bottlenecks           text[] default '{}',
  tools_used            text[] default '{}',
  financial_impact      text[] default '{}',
  referrals             text[] default '{}',
  key_insights          text[] default '{}',
  raw_conversation      jsonb  default '[]'
);

create index if not exists interviews_created_at_idx
  on public.interviews (created_at desc);

-- ── Auto-update updated_at on every UPDATE ──────────────────
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.interviews;
create trigger set_updated_at
  before update on public.interviews
  for each row execute function public.update_updated_at_column();

-- ── Row Level Security ──────────────────────────────────────
-- Every read/write in this app goes through server-side API routes that use the
-- service-role key, which BYPASSES RLS. We therefore enable RLS with NO public
-- policies so anon/public clients have zero direct access to the table.
alter table public.interviews enable row level security;

-- If you ever want the interview app to write directly from the browser with the
-- anon key instead of via /api/save, drop the comment below and add policies:
--
--   create policy "anon insert" on public.interviews
--     for insert to anon with check (true);
--   create policy "anon update" on public.interviews
--     for update to anon using (true) with check (true);
--   create policy "auth select" on public.interviews
--     for select to authenticated using (true);
