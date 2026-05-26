import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "askbible-mobile-nature-active-scene-v1";
const LOOP_ALL_KEY = "askbible-mobile-nature-scene-loop-all-v1";

export async function readNatureActiveSceneId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export async function writeNatureActiveSceneId(id: string): Promise<void> {
  const next = id.trim();
  if (!next) return;
  await AsyncStorage.setItem(KEY, next);
}

export async function readNatureLoopAllScenesEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(LOOP_ALL_KEY);
    if (!v?.trim()) return false;
    return v.trim() === "1";
  } catch {
    return false;
  }
}

export async function writeNatureLoopAllScenesEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(LOOP_ALL_KEY, enabled ? "1" : "0");
}
