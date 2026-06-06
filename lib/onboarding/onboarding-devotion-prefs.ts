const ONBOARDING_COMPLETED_KEY = "askbible-onboarding-completed";
const SELECTED_COMPANION_NEEDS_KEY = "askbible-selected-companion-needs";
const ONBOARDING_NICKNAME_KEY = "askbible-onboarding-nickname";

export type CompanionNeedId =
  | "quiet"
  | "encouragement"
  | "start_reading"
  | "understand_bible"
  | "daily_closeness";

function storageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

export function readOnboardingCompleted(): boolean {
  if (!storageAvailable()) return false;
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

export function readSelectedCompanionNeeds(): CompanionNeedId[] {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(SELECTED_COMPANION_NEEDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CompanionNeedId => typeof item === "string");
  } catch {
    return [];
  }
}

export async function readOnboardingNickname(): Promise<string> {
  return readOnboardingNicknameSync();
}

export function readOnboardingNicknameSync(): string {
  if (!storageAvailable()) return "";
  try {
    return localStorage.getItem(ONBOARDING_NICKNAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function shouldShowOnboardingDevotionIntro(): boolean {
  return !readOnboardingCompleted();
}

export async function completeOnboardingDevotionIntro(
  selectedCompanionNeeds: CompanionNeedId[],
  nickname?: string,
): Promise<void> {
  if (!storageAvailable()) return;
  try {
    const trimmed = (nickname ?? "").trim();
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "1");
    localStorage.setItem(SELECTED_COMPANION_NEEDS_KEY, JSON.stringify(selectedCompanionNeeds));
    localStorage.setItem(ONBOARDING_NICKNAME_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

export async function resetOnboardingDevotionIntro(): Promise<void> {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    localStorage.removeItem(SELECTED_COMPANION_NEEDS_KEY);
    localStorage.removeItem(ONBOARDING_NICKNAME_KEY);
  } catch {
    /* ignore */
  }
}
