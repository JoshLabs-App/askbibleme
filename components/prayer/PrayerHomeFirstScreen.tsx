import Link from "next/link";
import type { ReactNode } from "react";

function IconSpark(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M12 2l1.2 4.2L17 7l-3.8 1.8L12 13l-1.2-4.2L7 7l3.8-1.8L12 2zm0 11l.9 3.1L16 17l-3.1 1-1.9 2.9-1-3.1L7 17l3.1-1 1.9-2.9 1 3.1z" />
    </svg>
  );
}

function IconBook(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={props.className} aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" strokeLinejoin="round" />
    </svg>
  );
}

function IconDove(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={props.className} aria-hidden>
      <path
        d="M3 12c2.5-2 6-3 9-2 2.5.6 4.5 2 6 4M3 12c1.5 2 4 3.5 7 3.5 2 0 3.5-.5 4.5-1.5M10 10c-1-2-1-4.5.5-6.5C12 1 15 1 17 2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHeart(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={props.className} aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSprout(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={props.className} aria-hidden>
      <path d="M12 22V12M12 12c-2-4-6-5-9-4 1 3 4 5 9 4zm0 0c2-4 6-5 9-4-1 3-4 5-9 4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BranchDecoration(props: { className?: string }) {
  return (
    <svg viewBox="0 0 56 120" fill="none" className={props.className} aria-hidden>
      <path
        d="M8 110c12-8 18-22 20-38 2-18-2-36 8-52M28 72c6-10 14-16 24-18M22 48c8-4 16-4 24 2M18 28c4-6 10-10 18-12"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="40" cy="22" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="34" cy="34" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

const STEPS: { icon: ReactNode; body: ReactNode }[] = [
  {
    icon: <IconBook className="h-5 w-5" />,
    body: (
      <>
        当你读到一段经文时，
        <br />
        可以慢慢地，把它变成祷告，
        <br />
        带到神面前。
      </>
    ),
  },
  {
    icon: <IconDove className="h-5 w-5" />,
    body: (
      <>
        就像主祷文所教导的（
        <Link href="/read/MAT/6" className="font-medium text-ink/85 underline decoration-amber-400/50 underline-offset-[0.2em] hover:decoration-amber-500/70">
          马太福音 6:9–13
        </Link>
        ），
        <br />
        我们先把心转向神，
        <br />
        也把自己的需要交托给祂。
      </>
    ),
  },
  {
    icon: <IconHeart className="h-5 w-5" />,
    body: (
      <>
        你不需要勉强自己说什么，
        <br />
        可以从神的话开始。
      </>
    ),
  },
  {
    icon: <IconSprout className="h-5 w-5" />,
    body: (
      <>
        慢慢地，
        <br />
        你会发现，祷告不再是习惯，
        <br />
        而是与神真实的相遇。
      </>
    ),
  },
];

/** 祷告首页首屏：标题区、引用卡、四步时间线（暖色纸感衬底） */
export function PrayerHomeFirstScreen() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-0 top-0 text-amber-600/40 sm:text-amber-600/45" aria-hidden>
        <IconSpark className="h-7 w-7 sm:h-8 sm:w-8" />
      </div>

      <header className="relative max-w-prose pr-10 pt-1">
        <h1 className="font-serif text-[1.65rem] font-medium leading-[1.15] tracking-tight text-ink/92 sm:text-[1.85rem]">
          <span className="relative inline-block">
            祷告与经文
            <span className="absolute -bottom-1 left-0 h-0.5 w-[2.35rem] rounded-full bg-amber-500/90 sm:w-[2.75rem]" aria-hidden />
          </span>
        </h1>
        <p className="mt-4 text-[15px] font-normal leading-snug text-stone-600 sm:text-[16px] dark:text-stone-400">让经文成为你与神的对话</p>
      </header>

      <div className="relative mt-8 overflow-hidden rounded-2xl border border-amber-200/45 bg-gradient-to-br from-orange-50/95 via-[#fff9f2] to-[#f5e8d8] px-4 py-6 sm:mt-10 sm:px-6 sm:py-7 dark:border-amber-900/35 dark:from-amber-950/35 dark:via-stone-900/80 dark:to-[#1f1814]">
        <div className="flex gap-4 sm:gap-5">
          <div className="flex shrink-0 flex-col items-start gap-1">
            <span className="font-serif text-[3.25rem] leading-none text-amber-600/80 sm:text-[3.75rem] dark:text-amber-500/70" aria-hidden>
              “
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700/90 dark:text-amber-400/90">如何祷告</span>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <p className="font-serif text-[17px] leading-[1.65] text-ink/90 sm:text-[18px] sm:leading-[1.6]">
              祷告不只是向神说话，
              <br />
              也是用祂的话来回应祂。
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-center gap-2 pl-2 sm:flex">
            <span className="h-full min-h-[4.5rem] w-px bg-amber-200/55 dark:bg-amber-800/35" aria-hidden />
            <BranchDecoration className="h-24 w-10 text-amber-700/45 dark:text-amber-500/35" />
          </div>
        </div>
      </div>

      <div className="relative mt-10 sm:mt-12">
        <div className="pointer-events-none absolute left-[1.125rem] top-3 bottom-3 w-0 border-l border-dashed border-amber-300/55 sm:left-[1.25rem] dark:border-amber-800/35" aria-hidden />
        <ol className="relative m-0 list-none space-y-0 p-0">
          {STEPS.map((step, i) => (
            <li key={i} className="relative border-b border-amber-200/35 pb-8 pt-0 last:border-b-0 last:pb-0 dark:border-stone-700/50">
              <span
                className="absolute left-[0.6rem] top-[1.35rem] z-[1] h-2 w-2 rounded-full border-2 border-[#efe3d8] bg-amber-600 sm:left-[0.7rem] sm:top-[1.45rem] dark:border-[#151210] dark:bg-amber-500"
                aria-hidden
              />
              <div className="flex gap-4 pl-10 sm:gap-5 sm:pl-11">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100/95 text-amber-950 ring-1 ring-amber-300/55 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-800/45">
                  {step.icon}
                </div>
                <p className="min-w-0 flex-1 pt-1.5 text-[15px] leading-[1.72] text-ink/84 sm:text-[15px] sm:leading-[1.75]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-12 border-b border-amber-200/40 sm:mt-14 dark:border-stone-700/50" aria-hidden />
    </div>
  );
}
