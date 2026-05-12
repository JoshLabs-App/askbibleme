/**
 * 静湖：轻量 CSS 呼吸光团（无 WebGL）。音乐 / 放松等场景共用。
 */
export function LagoonBreatheOrb() {
  return (
    <div
      className="animate-relax-breathe pointer-events-none relative flex h-[min(58vw,17rem)] w-[min(58vw,17rem)] items-center justify-center motion-reduce:animate-none sm:h-[17.5rem] sm:w-[17.5rem]"
      aria-hidden
    >
      <div className="absolute inset-[8%] rounded-full bg-gradient-to-br from-sky-400/55 via-cyan-400/40 to-teal-500/30 shadow-[0_0_72px_rgba(56,189,248,0.38),0_0_100px_rgba(45,212,191,0.22)]" />
      <div className="pointer-events-none absolute inset-[22%] rounded-full bg-gradient-to-tl from-white/50 via-sky-100/25 to-transparent opacity-95" />
      <div className="pointer-events-none absolute inset-[38%] rounded-full bg-white/45 blur-xl" />
    </div>
  );
}
