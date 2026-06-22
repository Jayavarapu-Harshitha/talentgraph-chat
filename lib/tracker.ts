import { TrackerData, emptyTracker, Interview } from "./types";
import { TRACKER_OPEN, TRACKER_CLOSE } from "./systemPrompt";

const ARRAY_KEYS: (keyof TrackerData)[] = [
  "pain_points",
  "bottlenecks",
  "tools",
  "costs",
  "referrals",
  "insights",
];
const SCALAR_KEYS: (keyof TrackerData)[] = ["name", "company", "role", "archetype"];

/**
 * Split a raw model reply into the visible prose and the tracker delta.
 * Tolerant: if no/invalid block is found, returns the text untouched and an
 * empty delta.
 */
export function splitReplyAndTracker(raw: string): {
  reply: string;
  tracker: TrackerData;
} {
  const start = raw.indexOf(TRACKER_OPEN);
  if (start === -1) {
    return { reply: raw.trim(), tracker: emptyTracker() };
  }
  const reply = raw.slice(0, start).trim();
  const after = raw.slice(start + TRACKER_OPEN.length);
  const end = after.indexOf(TRACKER_CLOSE);
  const jsonText = end === -1 ? after : after.slice(0, end);
  return { reply, tracker: parseTrackerBlock(jsonText) };
}

/** Tolerant JSON parse of the inner tracker block → normalized TrackerData. */
export function parseTrackerBlock(jsonText: string): TrackerData {
  const result = emptyTracker();
  if (!jsonText) return result;

  // Grab the first {...} object even if the model added stray characters.
  const objStart = jsonText.indexOf("{");
  const objEnd = jsonText.lastIndexOf("}");
  if (objStart === -1 || objEnd === -1 || objEnd <= objStart) return result;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText.slice(objStart, objEnd + 1));
  } catch {
    return result;
  }

  for (const key of SCALAR_KEYS) {
    const v = parsed[key];
    if (typeof v === "string") result[key] = v.trim() as never;
  }
  for (const key of ARRAY_KEYS) {
    const v = parsed[key];
    if (Array.isArray(v)) {
      (result[key] as string[]) = v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  return result;
}

function unionDedup(current: string[], incoming: string[]): string[] {
  const out = [...current];
  const seen = new Set(current.map((x) => x.toLowerCase()));
  for (const item of incoming) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Merge a delta into the current tracker. Scalars overwrite only when the delta
 * provides a non-empty value; arrays union with case-insensitive dedup so the
 * same pain point / tool never accumulates twice.
 */
export function mergeTracker(current: TrackerData, delta: TrackerData): TrackerData {
  const next: TrackerData = { ...current };
  for (const key of SCALAR_KEYS) {
    const v = delta[key] as string;
    if (v && v.trim()) next[key] = v.trim() as never;
  }
  for (const key of ARRAY_KEYS) {
    (next[key] as string[]) = unionDedup(
      current[key] as string[],
      delta[key] as string[]
    );
  }
  return next;
}

/** Total number of insight items captured (drives the sidebar progress bar). */
export function trackerInsightCount(t: TrackerData): number {
  return (
    t.pain_points.length +
    t.bottlenecks.length +
    t.tools.length +
    t.costs.length +
    t.referrals.length +
    t.insights.length
  );
}

/** Map the in-app TrackerData onto the DB column names for `interviews`. */
export function trackerToColumns(t: TrackerData) {
  return {
    interviewee_name: t.name || null,
    company: t.company || null,
    role: t.role || null,
    archetype: t.archetype || null,
    pain_points: t.pain_points,
    bottlenecks: t.bottlenecks,
    tools_used: t.tools,
    financial_impact: t.costs,
    referrals: t.referrals,
    key_insights: t.insights,
  };
}

/** Inverse: build a TrackerData view from a stored Interview row. */
export function interviewToTracker(row: Interview): TrackerData {
  return {
    name: row.interviewee_name ?? "",
    company: row.company ?? "",
    role: row.role ?? "",
    archetype: row.archetype ?? "",
    pain_points: row.pain_points ?? [],
    bottlenecks: row.bottlenecks ?? [],
    tools: row.tools_used ?? [],
    costs: row.financial_impact ?? [],
    referrals: row.referrals ?? [],
    insights: row.key_insights ?? [],
  };
}
