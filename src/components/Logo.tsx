export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <div className="select-none text-center">
      <div className={`font-extrabold uppercase leading-none tracking-tight ${big ? "text-5xl" : "text-2xl"}`}>
        <span className="text-white">Quiz</span>
        <span className="bg-gradient-to-b from-[#ffe08a] via-gold to-[#d99a1e] bg-clip-text text-transparent">crafter</span>
      </div>
      {big && <div className="eyebrow mt-3">Fresh questions. Every game.</div>}
    </div>
  );
}

/** A team's colour chip with its initial, used everywhere a team is named. */
export function TeamBadge({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-md font-bold text-black/80"
      style={{ width: size, height: size, background: color, fontSize: size * 0.5, boxShadow: `0 0 14px ${color}66` }}
    >
      {name[0]}
    </span>
  );
}
