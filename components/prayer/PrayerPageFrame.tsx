import type { ReactNode } from "react";

/** 祷告区统一版心：略宽于读经章，底栏留白略多 */
export function PrayerPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-0 w-full max-w-[36rem] flex-1 px-5 pb-28 pt-3 text-ink [-webkit-overflow-scrolling:touch] sm:max-w-[40rem] md:px-8">
      {children}
    </div>
  );
}
