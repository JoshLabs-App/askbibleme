import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** 探索区长文页共用版心（文章、经文列表等） */
export function ExploreProsePage({ children, className }: Props) {
  return (
    <div
      className={[
        "explore-prose-page mx-auto w-full max-w-xl flex-1 px-5 pb-24 pt-6 sm:max-w-2xl md:px-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
