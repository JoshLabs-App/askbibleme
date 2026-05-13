import type { ReactNode } from "react";

/** 祷告区版心：全宽由壳层暖色铺底，此处只负责 max-width 与内边距（避免窄块渐变与滚动区冷色错位）。 */
export function PrayerPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="mx-auto min-h-0 w-full max-w-[36rem] flex-1 px-5 pb-28 pt-3 text-ink [-webkit-overflow-scrolling:touch] sm:max-w-[40rem] md:px-8">
        {children}
      </div>
    </div>
  );
}
