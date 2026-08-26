export function formatDisplayNickname(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** 探索页问候等：避免把整段邮箱当昵称撑破排版。 */
export function formatGreetingDisplayName(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  if (trimmed.includes("@")) {
    const at = trimmed.indexOf("@");
    const local = trimmed.slice(0, at).trim();
    const domain = trimmed.slice(at + 1).toLowerCase();
    if (!local || domain.includes("privaterelay.appleid.com") || local.length > 18) {
      return "";
    }
    return formatDisplayNickname(local);
  }

  return trimmed;
}
