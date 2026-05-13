import type { ReactNode } from "react";

/** 祷告区统一版心：暖色衬底 + 略宽于读经章，底栏留白略多 */
export function PrayerPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-0 w-full max-w-[36rem] flex-1 rounded-t-[1.25rem] bg-gradient-to-b from-[#faf6f0] via-[#f7f0e6] to-[#f2e8dc] px-5 pb-28 pt-3 text-ink [-webkit-overflow-scrolling:touch] sm:max-w-[40rem] md:px-8 dark:from-stone-950 dark:via-[#1a1512] dark:to-[#14100d]">
      {children}
    </div>
  );
}
