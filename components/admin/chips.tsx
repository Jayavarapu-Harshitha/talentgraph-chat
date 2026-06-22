export interface AdminChipStyle {
  bg: string;
  text: string;
}

export const ADMIN_CHIPS: Record<string, AdminChipStyle> = {
  pain: { bg: "#fff0f0", text: "#B92B2B" },
  bottleneck: { bg: "#eff6ff", text: "#2E6DA4" },
  tool: { bg: "#f0fff4", text: "#276749" },
  cost: { bg: "#fffbeb", text: "#92600a" },
  referral: { bg: "#faf5ff", text: "#7c3aed" },
};

export function Chips({
  items,
  style,
  max,
}: {
  items: string[];
  style: AdminChipStyle;
  max?: number;
}) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-txt-soft">—</span>;
  }
  const shown = max ? items.slice(0, max) : items;
  const extra = max ? items.length - shown.length : 0;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="rounded px-1.5 py-0.5 text-[11px] leading-tight"
          style={{ backgroundColor: style.bg, color: style.text }}
        >
          {item}
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded bg-bg px-1.5 py-0.5 text-[11px] text-txt-soft">
          +{extra}
        </span>
      )}
    </div>
  );
}
