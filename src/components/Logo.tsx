export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <div className={`select-none text-center font-bold leading-none tracking-tight ${big ? "text-6xl" : "text-2xl"}`}>
      <span className="inline-block -rotate-3 text-yellow drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]">Quiz</span>
      <span className="inline-block rotate-2 bg-gradient-to-r from-pink via-violet to-sky bg-clip-text text-transparent drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]">
        crafter
      </span>
      {big && <div className="mt-3 text-base font-medium tracking-normal text-muted">Team quiz battles for the whole family</div>}
    </div>
  );
}
