import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearOnboardingDevotionCompletedThisSession,
  markOnboardingDevotionCompletedThisSession,
} from "./onboarding-devotion-gate";

const ONBOARDING_COMPLETED_KEY = "onboardingCompleted";
const SELECTED_COMPANION_NEEDS_KEY = "selectedCompanionNeeds";
const ONBOARDING_NICKNAME_KEY = "onboardingNickname";

export type CompanionNeedId =
  | "quiet"
  | "encouragement"
  | "start_reading"
  | "understand_bible"
  | "daily_closeness";

export async function readOnboardingCompleted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function readSelectedCompanionNeeds(): Promise<CompanionNeedId[]> {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_COMPANION_NEEDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CompanionNeedId => typeof item === "string");
  } catch {
    return [];
  }
}

export async function readOnboardingNickname(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_NICKNAME_KEY))?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function shouldShowOnboardingDevotionIntro(): Promise<boolean> {
  return !(await readOnboardingCompleted());
}

export async function completeOnboardingDevotionIntro(
  selectedCompanionNeeds: CompanionNeedId[],
  nickname?: string,
): Promise<void> {
  // 先标本会话完成，再写盘：略过导航离开欢迎页时根布局不再盖闪屏/强制跳回。
  markOnboardingDevotionCompletedThisSession();
  try {
    const trimmed = (nickname ?? "").trim();
    await AsyncStorage.multiSet([
      [ONBOARDING_COMPLETED_KEY, "1"],
      [SELECTED_COMPANION_NEEDS_KEY, JSON.stringify(selectedCompanionNeeds)],
      [ONBOARDING_NICKNAME_KEY, trimmed],
    ]);
  } catch {
    /* ignore */
  }
}

export async function resetOnboardingDevotionIntro(): Promise<void> {
  clearOnboardingDevotionCompletedThisSession();
  try {
    await AsyncStorage.multiRemove([
      ONBOARDING_COMPLETED_KEY,
      SELECTED_COMPANION_NEEDS_KEY,
      ONBOARDING_NICKNAME_KEY,
    ]);
  } catch {
    /* ignore */
  }
}
