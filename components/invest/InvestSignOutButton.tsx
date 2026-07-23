"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function InvestSignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase?.auth.signOut();
    } finally {
      window.location.assign("/invest");
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void signOut()}
      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-white/60 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
    >
      {pending ? "正在退出…" : "切换账户"}
    </button>
  );
}
