export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-border">
        🎓
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-[4px] border border-border bg-card px-4 py-4 shadow-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-txt-soft animate-typing-bounce"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}
