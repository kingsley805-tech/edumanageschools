/** Subject card colors using school theme chart tokens (not hardcoded mockup colors). */
const PALETTE = [
  { bg: "hsl(var(--primary) / 0.18)", border: "hsl(var(--primary) / 0.45)", text: "hsl(var(--primary))" },
  { bg: "hsl(var(--chart-3) / 0.2)", border: "hsl(var(--chart-3) / 0.5)", text: "hsl(var(--chart-3))" },
  { bg: "hsl(var(--success) / 0.18)", border: "hsl(var(--success) / 0.45)", text: "hsl(var(--success))" },
  { bg: "hsl(var(--warning) / 0.2)", border: "hsl(var(--warning) / 0.5)", text: "hsl(var(--warning))" },
  { bg: "hsl(var(--chart-5) / 0.22)", border: "hsl(var(--chart-5) / 0.5)", text: "hsl(var(--chart-5))" },
  { bg: "hsl(var(--info) / 0.2)", border: "hsl(var(--info) / 0.45)", text: "hsl(var(--info))" },
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h << 5) - h + key.charCodeAt(i);
  return Math.abs(h);
}

export function getSubjectColor(subjectId: string) {
  return PALETTE[hashKey(subjectId) % PALETTE.length];
}

import type { CSSProperties } from "react";

export function subjectColorStyle(subjectId: string): CSSProperties {
  const c = getSubjectColor(subjectId);
  return {
    backgroundColor: c.bg,
    borderColor: c.border,
    color: c.text,
  };
}
