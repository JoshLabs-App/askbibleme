import type { User } from "@supabase/supabase-js";

type InvestIdentity = Pick<User, "email" | "app_metadata">;

export function parseInvestAllowedGoogleEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function hasGoogleAuthProvider(appMetadata: User["app_metadata"]): boolean {
  if (!appMetadata || typeof appMetadata !== "object") return false;
  if (appMetadata.provider === "google") return true;
  return Array.isArray(appMetadata.providers) && appMetadata.providers.includes("google");
}

export function isAllowedInvestGoogleUser(
  user: InvestIdentity,
  allowedEmails: ReadonlySet<string>,
): boolean {
  const email = user.email?.trim().toLowerCase();
  if (!email || !allowedEmails.has(email)) return false;
  return hasGoogleAuthProvider(user.app_metadata);
}
