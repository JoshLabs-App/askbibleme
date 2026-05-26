import AsyncStorage from "@react-native-async-storage/async-storage";

const FIRST_OPEN_HINT_KEY = "askbible-first-open-hint-seen";

export async function readFirstOpenHintSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FIRST_OPEN_HINT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markFirstOpenHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_OPEN_HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function shouldShowFirstOpenHint(): Promise<boolean> {
  return !(await readFirstOpenHintSeen());
}
