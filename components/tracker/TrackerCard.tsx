"use client";

export interface ChipStyle {
  bg: string;
  text: string;
}

interface Props {
  title: string;
  items: string[];
  chip: ChipStyle;
}

/** A single tracker section: heading + animated chips. Hidden when empty. */
export default function TrackerCard({ title, items, chip }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="animate-slide-in">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
        {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="animate-slide-in rounded-md px-2 py-1 text-[12px] leading-snug"
            style={{ backgroundColor: chip.bg, color: chip.text }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
