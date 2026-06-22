"use client";

import { Interview } from "@/lib/types";

export default function StatsRow({ sessions }: { sessions: Interview[] }) {
  const sum = (pick: (s: Interview) => number) =>
    sessions.reduce((acc, s) => acc + pick(s), 0);

  const cards = [
    { label: "Total Interviews", value: sessions.length, accent: "#0D1B2A" },
    { label: "Pain Points Captured", value: sum((s) => s.pain_points.length), accent: "#B92B2B" },
    { label: "Bottlenecks Identified", value: sum((s) => s.bottlenecks.length), accent: "#2E6DA4" },
    { label: "Tools Mentioned", value: sum((s) => s.tools_used.length), accent: "#276749" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div
            className="text-3xl font-semibold"
            style={{ color: c.accent }}
          >
            {c.value}
          </div>
          <div className="mt-1 text-[13px] font-medium text-txt-soft">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}
