import * as XLSX from "xlsx";
import { Interview } from "./types";

function fmtDate(row: Interview): string {
  return row.conversation_date || (row.created_at ? row.created_at.slice(0, 10) : "");
}

/** Build the "Insights Gained" cell: every captured item, category-tagged. */
function insightsGained(row: Interview): string {
  const parts: string[] = [];
  row.pain_points.forEach((p) => parts.push(`PAIN: ${p}`));
  row.bottlenecks.forEach((b) => parts.push(`BOTTLENECK: ${b}`));
  row.tools_used.forEach((t) => parts.push(`TOOL: ${t}`));
  row.financial_impact.forEach((c) => parts.push(`COST: ${c}`));
  row.referrals.forEach((r) => parts.push(`REFERRAL: ${r}`));
  row.key_insights.forEach((i) => parts.push(`INSIGHT: ${i}`));
  return parts.join(" | ");
}

function totalInsights(row: Interview): number {
  return (
    row.pain_points.length +
    row.bottlenecks.length +
    row.tools_used.length +
    row.financial_impact.length +
    row.referrals.length +
    row.key_insights.length
  );
}

function summarySheet(sessions: Interview[]) {
  const rows = sessions.map((s) => ({
    Date: fmtDate(s),
    Name: s.interviewee_name ?? "",
    Company: s.company ?? "",
    Role: s.role ?? "",
    Archetype: s.archetype ?? "",
    "Pain #": s.pain_points.length,
    "Bottleneck #": s.bottlenecks.length,
    "Tools #": s.tools_used.length,
    Referrals: s.referrals.join("; "),
    "Total Insights": totalInsights(s),
  }));
  return XLSX.utils.json_to_sheet(rows, {
    header: [
      "Date",
      "Name",
      "Company",
      "Role",
      "Archetype",
      "Pain #",
      "Bottleneck #",
      "Tools #",
      "Referrals",
      "Total Insights",
    ],
  });
}

function activityTrackerSheet(sessions: Interview[]) {
  const rows = sessions.map((s) => ({
    "Conversation Date": fmtDate(s),
    "Conversation Time": s.conversation_time ?? "",
    "Conversation Location": s.conversation_location ?? "Virtual / Remote",
    "Interviewee Name / Pseudonym": s.interviewee_name ?? "",
    "Archetype Fit Description": s.archetype ?? "",
    "Insights Gained": insightsGained(s),
  }));
  return XLSX.utils.json_to_sheet(rows, {
    header: [
      "Conversation Date",
      "Conversation Time",
      "Conversation Location",
      "Interviewee Name / Pseudonym",
      "Archetype Fit Description",
      "Insights Gained",
    ],
  });
}

function fullDetailSheet(sessions: Interview[]) {
  const rows: Record<string, string>[] = [];
  const push = (s: Interview, category: string, items: string[]) => {
    items.forEach((item) =>
      rows.push({
        "Session ID": s.session_id,
        Interviewee: s.interviewee_name ?? "",
        Company: s.company ?? "",
        Category: category,
        Item: item,
        Date: fmtDate(s),
      })
    );
  };
  sessions.forEach((s) => {
    push(s, "Pain Point", s.pain_points);
    push(s, "Bottleneck", s.bottlenecks);
    push(s, "Tool", s.tools_used);
    push(s, "Financial Impact", s.financial_impact);
    push(s, "Referral", s.referrals);
    push(s, "Key Insight", s.key_insights);
  });
  return XLSX.utils.json_to_sheet(rows, {
    header: ["Session ID", "Interviewee", "Company", "Category", "Item", "Date"],
  });
}

function transcriptsSheet(sessions: Interview[]) {
  const rows: Record<string, string>[] = [];
  sessions.forEach((s) => {
    (s.raw_conversation ?? []).forEach((m) => {
      rows.push({
        "Session ID": s.session_id,
        Interviewee: s.interviewee_name ?? "",
        Role: m.role,
        Message: m.content,
      });
    });
  });
  return XLSX.utils.json_to_sheet(rows, {
    header: ["Session ID", "Interviewee", "Role", "Message"],
  });
}

function assemble(sessions: Interview[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet(sessions), "Summary");
  XLSX.utils.book_append_sheet(wb, activityTrackerSheet(sessions), "Activity Tracker");
  XLSX.utils.book_append_sheet(wb, fullDetailSheet(sessions), "Full Detail");
  XLSX.utils.book_append_sheet(wb, transcriptsSheet(sessions), "Transcripts");
  return wb;
}

/** Trigger a browser download of the assembled workbook. */
function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export function exportAllSessions(sessions: Interview[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  download(assemble(sessions), `talentgraph-all-sessions-${stamp}.xlsx`);
}

export function exportSingleSession(session: Interview) {
  const safeName = (session.interviewee_name || session.session_id)
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  download(assemble([session]), `talentgraph-${safeName}.xlsx`);
}
