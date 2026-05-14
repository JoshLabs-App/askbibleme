import type { ReactNode } from "react";

/** 祷告区版心：全宽由壳层暖色铺底；顶、底各 150px 留白；底另加 5 行空白与浮动导航、安全区。 */
export function PrayerPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="mx-auto min-h-0 w-full max-w-[36rem] flex-1 px-5 pb-[calc(150px+5.25rem+env(safe-area-inset-bottom,0px))] pt-[150px] text-ink [-webkit-overflow-scrolling:touch] sm:max-w-[40rem] md:px-8">
        {children}
        {/* 页尾额外 5 行空白（与正文行高一致） */}
        <div aria-hidden className="pointer-events-none shrink-0 text-[15px] leading-[1.75]">
          <br />
          <br />
          <br />
          <br />
          <br />
        </div>
      </div>
    </div>
  );
}
