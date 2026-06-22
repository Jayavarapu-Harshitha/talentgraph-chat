"use client";

import { TrackerData } from "@/lib/types";
import { trackerInsightCount } from "@/lib/tracker";
import TrackerCard, { ChipStyle } from "./TrackerCard";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  tracker: TrackerData;
  saveStatus: SaveStatus;
  dateLabel: string;
  timeLabel: string;
  onSave: () => void;
  onCloseMobile?: () => void;
}

const CHIPS: Record<string, ChipStyle> = {
  pain: { bg: "rgba(185,43,43,0.28)", text: "#f08080" },
  bottleneck: { bg: "rgba(46,109,164,0.28)", text: "#7ab8e8" },
  tool: { bg: "rgba(80,180,120,0.22)", text: "#7dd4a4" },
  financial: { bg: "rgba(200,160,40,0.22)", text: "#e8c96a" },
  referral: { bg: "rgba(150,80,200,0.22)", text: "#c49ae8" },
};

// Progress bar fills as insights accumulate; ~12 is treated as a "rich" interview.
const PROGRESS_TARGET = 12;

const SAVE_META: Record<SaveStatus, { dot: string; label: string; pulse: boolean }> = {
  idle: { dot: "#718096", label: "Not saved yet", pulse: false },
  saving: { dot: "#E0A106", label: "Saving…", pulse: true },
  saved: { dot: "#2FA866", label: "Saved to database", pulse: false },
  error: { dot: "#D44040", label: "Save failed — retry", pulse: false },
};

export default function ActivitySidebar({
  tracker,
  saveStatus,
  dateLabel,
  timeLabel,
  onSave,
  onCloseMobile,
}: Props) {
  const count = trackerInsightCount(tracker);
  const progress = Math.min(100, Math.round((count / PROGRESS_TARGET) * 100));
  const save = SAVE_META[saveStatus];
  const hasProfile = tracker.name || tracker.company || tracker.role;

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col bg-navy text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-crimson text-sm font-bold tracking-tight">
              TG
            </div>
            <span className="text-[15px] font-semibold">TalentGraph Research</span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="text-white/60 hover:text-white md:hidden"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          )}
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-crimson-l">
          Live Session
        </p>
        <h3 className="mt-0.5 text-lg font-semibold">Activity Tracker</h3>

        {/* Save status */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${save.pulse ? "animate-save-pulse" : ""}`}
            style={{ backgroundColor: save.dot }}
          />
          <span className="text-xs text-white/70">{save.label}</span>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-white/50">
            <span>Insights captured</span>
            <span>{count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-steel transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="tg-scroll flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {!hasProfile && count === 0 && (
          <p className="text-[13px] leading-relaxed text-white/40">
            Insights will appear here as the conversation unfolds — interviewee
            profile, pain points, bottlenecks, tools, costs, and referrals.
          </p>
        )}

        {hasProfile && (
          <div className="animate-slide-in rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
              Interviewee
            </h4>
            {tracker.name && (
              <p className="text-sm font-semibold">{tracker.name}</p>
            )}
            {tracker.role && (
              <p className="text-[13px] text-white/70">{tracker.role}</p>
            )}
            {tracker.company && (
              <p className="text-[13px] text-white/70">{tracker.company}</p>
            )}
            {tracker.archetype && (
              <p className="mt-1.5 inline-block rounded bg-steel/25 px-2 py-0.5 text-[11px] text-steel-l">
                {tracker.archetype}
              </p>
            )}
          </div>
        )}

        <TrackerCard title="Pain Points" items={tracker.pain_points} chip={CHIPS.pain} />
        <TrackerCard title="Bottlenecks" items={tracker.bottlenecks} chip={CHIPS.bottleneck} />
        <TrackerCard title="Tools Used" items={tracker.tools} chip={CHIPS.tool} />
        <TrackerCard title="Financial Impact" items={tracker.costs} chip={CHIPS.financial} />
        <TrackerCard title="Referrals" items={tracker.referrals} chip={CHIPS.referral} />
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <div className="mb-3 flex items-center justify-between text-[12px] text-white/55">
          <span>{dateLabel}</span>
          <span>{timeLabel}</span>
        </div>
        <button
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="w-full rounded-lg bg-crimson px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-crimson-l disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Saving…" : "Save to Database"}
        </button>
      </div>
    </aside>
  );
}
