import Link from "next/link";
import type { ReactNode } from "react";

export type PrayerBreadcrumbItem = { href: string; label: string };

export function PrayerBreadcrumb({ items }: { items: PrayerBreadcrumbItem[] }): ReactNode {
  if (!items.length) return null;
  return (
    <nav aria-label="面包屑" className="prayer-muted flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[0.75em] leading-snug">
      {items.map((item, i) => (
        <span key={`${item.href}-${i}`} className="inline-flex items-baseline gap-x-1.5">
          {i > 0 ? <span aria-hidden className="select-none opacity-35">/</span> : null}
          <Link href={item.href} className="prayer-link prayer-link--quiet">
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
