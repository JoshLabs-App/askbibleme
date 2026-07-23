import "server-only";

import type { User } from "@supabase/supabase-js";
import {
  isAllowedInvestGoogleUser,
  parseInvestAllowedGoogleEmails,
} from "@/lib/invest-access-policy";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InvestAccessState =
  | { status: "misconfigured" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "authorized"; user: User };

export async function getInvestAccessState(): Promise<InvestAccessState> {
  const allowedEmails = parseInvestAllowedGoogleEmails(
    process.env.INVEST_ALLOWED_GOOGLE_EMAILS,
  );
  if (!isSupabaseAuthConfigured() || allowedEmails.size === 0) {
    return { status: "misconfigured" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "misconfigured" };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "unauthenticated" };

  if (!isAllowedInvestGoogleUser(data.user, allowedEmails)) {
    return { status: "forbidden" };
  }

  return { status: "authorized", user: data.user };
}
