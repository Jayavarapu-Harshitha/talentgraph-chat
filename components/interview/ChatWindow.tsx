"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface Props {
  messages: Message[];
  /** True while awaiting the first streamed token (shows the typing dots). */
  showTyping: boolean;
}

export default function ChatWindow({ messages, showTyping }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showTyping]);

  return (
    <div className="tg-scroll flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {showTyping && <TypingIndicator />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
