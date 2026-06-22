"use client";

import { Interview } from "@/lib/types";
import { exportSingleSession } from "@/lib/exportExcel";
import { ADMIN_CHIPS, Chips } from "./chips";

interface Props {
  session: Interview | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-txt-soft">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-txt">{value || "—"}</div>
    </div>
  );
}

function ChipSection({
  title,
  items,
  style,
}: {
  title: string;
  items: string[];
  style: { bg: string; text: string };
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-txt-soft">
        {title}
      </h4>
      <Chips items={items} style={style} />
    </div>
  );
}

export default function SessionDrawer({ session, onClose }: Props) {
  if (!session) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="tg-scroll h-full w-full max-w-[520px] animate-drawer-slide overflow-y-auto bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-txt">
            {session.interviewee_name || "Anonymous interviewee"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-txt-soft hover:bg-bg hover:text-txt"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-bg/60 p-4">
            <Field label="Date" value={session.conversation_date || session.created_at?.slice(0, 10)} />
            <Field label="Time" value={session.conversation_time} />
            <Field label="Name" value={session.interviewee_name || ""} />
            <Field label="Company" value={session.company || ""} />
            <Field label="Role" value={session.role || ""} />
            <Field label="Archetype" value={session.archetype || ""} />
          </div>

          <ChipSection title="Pain Points" items={session.pain_points} style={ADMIN_CHIPS.pain} />
          <ChipSection title="Bottlenecks" items={session.bottlenecks} style={ADMIN_CHIPS.bottleneck} />
          <ChipSection title="Tools" items={session.tools_used} style={ADMIN_CHIPS.tool} />
          <ChipSection title="Financial Impact" items={session.financial_impact} style={ADMIN_CHIPS.cost} />
          <ChipSection title="Referrals" items={session.referrals} style={ADMIN_CHIPS.referral} />

          {/* Key insights */}
          {session.key_insights.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-txt-soft">
                Key Insights
              </h4>
              <ol className="list-decimal space-y-1 pl-5 text-[13px] text-txt-mid">
                {session.key_insights.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Transcript */}
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-txt-soft">
              Full Transcript
            </h4>
            <div className="space-y-2">
              {(session.raw_conversation ?? []).map((m, i) => {
                const isBot = m.role !== "user";
                return (
                  <div key={i}>
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider text-txt-soft">
                      {isBot ? "Sri" : "Interviewee"}
                    </div>
                    <div
                      className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                        isBot
                          ? "bg-[#eff6ff] text-txt"
                          : "bg-bg text-txt-mid"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
              {(!session.raw_conversation || session.raw_conversation.length === 0) && (
                <p className="text-[13px] text-txt-soft">No transcript stored.</p>
              )}
            </div>
          </div>

          <button
            onClick={() => exportSingleSession(session)}
            className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-steel"
          >
            Export This Session (Excel)
          </button>
        </div>
      </div>
    </div>
  );
}
