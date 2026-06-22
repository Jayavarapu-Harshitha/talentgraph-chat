"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/lib/types";

export default function MessageBubble({ message }: { message: Message }) {
  const isBot = message.role === "bot";

  if (isBot) {
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-border">
          🎓
        </div>
        <div
          className="tg-markdown max-w-[78%] rounded-2xl rounded-tl-[4px] border border-border bg-card px-4 py-3 font-serif text-[15px] leading-relaxed text-txt shadow-[0_1px_2px_rgba(13,27,42,0.06)]"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || "…"}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-tr-[4px] bg-navy px-4 py-3 text-[15px] leading-relaxed text-white shadow-[0_1px_2px_rgba(13,27,42,0.12)]">
        {message.content}
      </div>
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-mid text-lg text-white">
        👤
      </div>
    </div>
  );
}
