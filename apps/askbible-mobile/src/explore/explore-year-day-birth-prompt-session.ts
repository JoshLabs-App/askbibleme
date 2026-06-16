import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "askbible-explore-birth-prompt-dismissed-v1";

/** 本会话内用户已关闭「必填」生日/名字设置，不再自动弹回。 */
let dismissedRequiredBirthProfilePrompt = false;

export function dismissRequiredYearDayBirthProfilePrompt(): void {
  dismissedRequiredBirthProfilePrompt = true;
  void AsyncStorage.setItem(STORAGE_KEY, "1");
}

export async function canAutoPromptRequiredYearDayBirthProfile(): Promise<boolean> {
  if (dismissedRequiredBirthProfilePrompt) return false;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === "1") {
      dismissedRequiredBirthProfilePrompt = true;
      return false;
    }
  } catch {
    // ignore
  }
  return true;
}

export function resetRequiredYearDayBirthProfilePromptDismissal(): void {
  dismissedRequiredBirthProfilePrompt = false;
  void AsyncStorage.removeItem(STORAGE_KEY);
}
