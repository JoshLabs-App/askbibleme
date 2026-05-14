"use client";

import type { ReactNode } from "react";

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <div
      data-admin-shell="light"
      className="fixed inset-0 z-0 flex min-h-0 w-full flex-col overflow-hidden bg-adminBg text-[15px] font-sans leading-relaxed text-adminFg antialiased selection:bg-sand/25"
    >
      {children}
    </div>
  );
}
