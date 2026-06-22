import { SuggestedQuestion } from "./types";

/**
 * Reference question bank. NOT shown in the UI — injected into the Claude/DeepSeek
 * system prompt so "Sri" asks well-rounded questions across the interview.
 */
export const suggestedQuestions: SuggestedQuestion[] = [
  { id: "q1", text: "Tell me about your role and what you're responsible for.", category: "context", description: "Establishes context and sets the stage." },
  { id: "q2", text: "What is the hardest part about your hiring process right now?", category: "problem", description: "Surfaces core problem without leading." },
  { id: "q3", text: "Walk me through how you currently screen candidates, step by step.", category: "process", description: "Reveals actual workflow and friction." },
  { id: "q4", text: "What frustrates you the most on a day-to-day basis?", category: "frustration", description: "Gets at emotional pain points." },
  { id: "q5", text: "How often do you run into that problem?", category: "frequency", description: "Validates whether problem is recurring." },
  { id: "q6", text: "What is the impact of that problem on your team or company?", category: "impact", description: "Quantifies cost in time, money, or morale." },
  { id: "q7", text: "What tools or systems do you use to manage hiring today?", category: "tools", description: "Maps competitive landscape and current stack." },
  { id: "q8", text: "What workarounds have you tried to solve this?", category: "workaround", description: "Shows desperation and what has been rejected." },
  { id: "q9", text: "What works well about your current process that you would keep?", category: "satisfaction", description: "Finds what is working, avoids assuming all broken." },
  { id: "q10", text: "If you could wave a magic wand and fix one thing, what would it be?", category: "aspiration", description: "Surfaces dream solution without pitching yours." },
  { id: "q11", text: "Would you pay for a solution that solved this? How much?", category: "payment", description: "Tests desirability with willingness to pay." },
  { id: "q12", text: "When you evaluate a new tool, what is your top priority?", category: "priority", description: "Reveals decision criteria and ranking of needs." },
  { id: "q13", text: "Who makes the final decision to buy a tool like this?", category: "decision", description: "Maps buying committee." },
  { id: "q14", text: "Who else should I talk to about this problem?", category: "referral", description: "Snowball sample to next conversation." },
];
