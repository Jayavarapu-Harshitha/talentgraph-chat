export interface Message {
  id: string;
  role: "bot" | "user";
  content: string;
  timestamp: Date;
}

/** Raw history shape exchanged with the API/model. */
export interface HistoryMessage {
  role: "bot" | "user";
  content: string;
}

export interface TrackerData {
  name: string;
  company: string;
  role: string;
  archetype: string;
  pain_points: string[];
  bottlenecks: string[];
  tools: string[];
  costs: string[];
  referrals: string[];
  insights: string[];
}

export interface Interview {
  id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  conversation_date: string;
  conversation_time: string;
  conversation_location: string;
  interviewee_name: string | null;
  company: string | null;
  role: string | null;
  archetype: string | null;
  pain_points: string[];
  bottlenecks: string[];
  tools_used: string[];
  financial_impact: string[];
  referrals: string[];
  key_insights: string[];
  raw_conversation: { role: string; content: string }[];
}

export interface SuggestedQuestion {
  id: string;
  text: string;
  category: string;
  description: string;
}

export function emptyTracker(): TrackerData {
  return {
    name: "",
    company: "",
    role: "",
    archetype: "",
    pain_points: [],
    bottlenecks: [],
    tools: [],
    costs: [],
    referrals: [],
    insights: [],
  };
}
