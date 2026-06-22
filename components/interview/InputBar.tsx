"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize up to 110px.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-off-white px-6 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-3 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-steel">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Share your perspective…"
            className="tg-scroll max-h-[110px] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-txt outline-none placeholder:text-txt-soft"
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="rounded-xl bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-steel disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-2 pl-1 text-xs text-txt-soft">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
