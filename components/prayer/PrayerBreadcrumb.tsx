import Link from "next/link";
import type { ReactNode } from "react";

export type PrayerBreadcrumbItem = { href: string; label: string };

export function PrayerBreadcrumb({ items }: { items: PrayerBreadcrumbItem[] }): ReactNode {
  if (!items.length) return null;
  return (
    <nav aria-label="面包屑" className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[12px] leading-snug text-muted">
      {items.map((item, i) => (
        <span key={`${item.href}-${i}`} className="inline-flex items-baseline gap-x-1.5">
          {i > 0 ? <span aria-hidden className="select-none text-ink/25">/</span> : null}
          <Link href={item.href} className="text-ink/60 underline decoration-transparent underline-offset-2 transition hover:text-ink/85 hover:decoration-ink/25">
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
