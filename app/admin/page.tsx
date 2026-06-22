"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Interview } from "@/lib/types";
import { exportAllSessions } from "@/lib/exportExcel";
import StatsRow from "@/components/admin/StatsRow";
import SessionsTable from "@/components/admin/SessionsTable";
import SessionDrawer from "@/components/admin/SessionDrawer";

const PW_KEY = "talentgraph:admin-pw";

type SortKey = "newest" | "oldest" | "most";

function totalInsights(s: Interview): number {
  return (
    s.pain_points.length +
    s.bottlenecks.length +
    s.tools_used.length +
    s.financial_impact.length +
    s.referrals.length +
    s.key_insights.length
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [sessions, setSessions] = useState<Interview[]>([]);
  const [selected, setSelected] = useState<Interview | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [lastSync, setLastSync] = useState<string>("");

  const fetchSessions = useCallback(async (pw: string) => {
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/sessions", {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) {
        setLoginError("Incorrect password.");
        setAuthed(false);
        sessionStorage.removeItem(PW_KEY);
        return false;
      }
      if (!res.ok) throw new Error(`sessions ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setAuthed(true);
      setLastSync(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      sessionStorage.setItem(PW_KEY, pw);
      return true;
    } catch (err) {
      console.error(err);
      setLoginError("Could not reach the server. Try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore an existing session-password if present.
  useEffect(() => {
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      setPassword(saved);
      fetchSessions(saved);
    }
  }, [fetchSessions]);

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    fetchSessions(password);
  };

  const refresh = () => {
    const pw = sessionStorage.getItem(PW_KEY);
    if (pw) fetchSessions(pw);
  };

  const signOut = () => {
    sessionStorage.removeItem(PW_KEY);
    setAuthed(false);
    setPassword("");
    setSessions([]);
    setSelected(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = sessions;
    if (q) {
      list = list.filter((s) =>
        [s.interviewee_name, s.company, s.role, s.archetype]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "most") return totalInsights(b) - totalInsights(a);
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return sorted;
  }, [sessions, search, sort]);

  // ── Login gate ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy px-4">
        <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-crimson text-sm font-bold text-white">
              TG
            </div>
            <span className="text-lg font-semibold text-txt">TalentGraph Admin</span>
          </div>
          <form onSubmit={onLogin} className="space-y-3">
            <label className="block text-[13px] font-medium text-txt-mid">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm text-txt outline-none focus:border-steel"
              placeholder="Enter admin password"
            />
            {loginError && (
              <p className="text-[13px] text-crimson">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-steel disabled:opacity-50"
            >
              {loading ? "Checking…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg">
      {/* Top nav */}
      <nav className="sticky top-0 z-30 flex items-center justify-between bg-navy px-6 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-crimson text-xs font-bold">
            TG
          </div>
          <span className="font-semibold">TalentGraph Admin</span>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="hidden rounded-md bg-white/10 px-2.5 py-1 text-[12px] text-white/70 sm:inline">
              Last sync {lastSync}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] hover:bg-white/20 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => exportAllSessions(sessions)}
            disabled={sessions.length === 0}
            className="rounded-md bg-crimson px-3 py-1.5 text-[13px] font-medium hover:bg-crimson-l disabled:opacity-50"
          >
            Export All (Excel)
          </button>
          <button
            onClick={signOut}
            className="rounded-md px-3 py-1.5 text-[13px] text-white/70 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
        <StatsRow sessions={sessions} />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, role, or archetype…"
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-txt outline-none focus:border-steel"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-txt outline-none focus:border-steel"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most">Most insights</option>
          </select>
        </div>

        <SessionsTable sessions={filtered} onSelect={setSelected} />
      </div>

      <SessionDrawer session={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
