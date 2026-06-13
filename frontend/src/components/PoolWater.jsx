// The signature CoinFish visual: a tank whose water level = pool utilisation
// (how much of the pool is lent out). Two offset wave layers wobble across the
// surface; a fish bobs at the waterline. Used on pool cards and dashboards.
export default function PoolWater({ level = 0.5, height = 150, label, sublabel, playful = true }) {
  const pct = Math.max(0, Math.min(1, level));
  const waterTop = `${(1 - pct) * 100}%`;
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{
        height,
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.04))",
        border: "1px solid var(--line)",
      }}
    >
      {/* water body */}
      <div
        className="absolute left-0 right-0 bottom-0 transition-[top] duration-700 ease-out"
        style={{
          top: waterTop,
          background: "linear-gradient(180deg, var(--water-top), var(--water-bot))",
        }}
      >
        {/* two wave strips slide horizontally for the wobble */}
        <Wave className="animate-wave" opacity={0.45} top={-10} />
        <Wave className="animate-wave-slow" opacity={0.7} top={-6} />
        {playful && <span className="animate-bob absolute right-3 top-1 text-xl select-none">🐟</span>}
      </div>

      {/* gridlines for a pool-tile feel */}
      <div className="pointer-events-none absolute inset-0 opacity-20"
        style={{ backgroundImage:
          "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "26px 26px" }} />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-2xl font-extrabold drop-shadow">{Math.round(pct * 100)}%</div>
        {label && <div className="text-xs font-semibold opacity-80">{label}</div>}
        {sublabel && <div className="text-[10px] opacity-70">{sublabel}</div>}
      </div>
    </div>
  );
}

function Wave({ className, opacity, top }) {
  return (
    <svg
      className={`absolute left-0 ${className}`}
      style={{ top, width: "200%", height: 22, opacity }}
      viewBox="0 0 1200 22"
      preserveAspectRatio="none"
    >
      <path
        d="M0 11 C 150 0, 300 22, 450 11 S 750 0, 900 11 S 1200 22, 1200 11 L1200 22 L0 22 Z"
        fill="var(--water-top)"
      />
    </svg>
  );
}
