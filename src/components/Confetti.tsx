"use client";

import { useMemo } from "react";

const COLORS = ["#f5c542", "#ffffff", "#3fd2ff", "#2f7bff", "#ffe08a"];

export function Confetti({ pieces = 50 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.6 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
      })),
    [pieces],
  );
  return (
    <div aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti"
          style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }}
        />
      ))}
    </div>
  );
}
