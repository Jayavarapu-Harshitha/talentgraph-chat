"use client";

import { Interview } from "@/lib/types";
import { ADMIN_CHIPS, Chips } from "./chips";

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

interface Props {
  sessions: Interview[];
  onSelect: (s: Interview) => void;
}

export default function SessionsTable({ sessions, onSelect }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-txt-soft shadow-sm">
        No interviews match your filters yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bg text-[11px] uppercase tracking-wider text-txt-soft">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Pain Points</th>
              <th className="px-4 py-3 font-semibold">Tools</th>
              <th className="px-4 py-3 text-right font-semibold">Insights</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                onClick={() => onSelect(s)}
                className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-bg"
              >
                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-txt-mid">
                  {s.conversation_date || s.created_at?.slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-[13px] font-medium text-txt">
                  {s.interviewee_name || "—"}
                </td>
                <td className="px-4 py-3 text-[13px] text-txt-mid">
                  {s.company || "—"}
                </td>
                <td className="px-4 py-3 text-[13px] text-txt-mid">
                  {s.role || "—"}
                </td>
                <td className="px-4 py-3">
                  <Chips items={s.pain_points} style={ADMIN_CHIPS.pain} max={2} />
                </td>
                <td className="px-4 py-3">
                  <Chips items={s.tools_used} style={ADMIN_CHIPS.tool} max={2} />
                </td>
                <td className="px-4 py-3 text-right text-[13px] font-semibold text-txt">
                  {totalInsights(s)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
