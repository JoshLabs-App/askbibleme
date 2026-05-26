import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "askbible-mobile-nature-ambient-scene-v1";
const KEY_VOLUME = "askbible-mobile-nature-ambient-master-volume-v1";

export async function readNatureAmbientSceneSlotId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export async function writeNatureAmbientSceneSlotId(id: string): Promise<void> {
  const next = id.trim();
  if (!next) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, next);
}

export async function readNatureAmbientMasterVolume(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_VOLUME);
    const value = Number(raw);
    if (!Number.isFinite(value)) return 1;
    return Math.max(0, Math.min(1, value));
  } catch {
    return 1;
  }
}

export async function writeNatureAmbientMasterVolume(value: number): Promise<void> {
  const next = Math.max(0, Math.min(1, Number(value)));
  await AsyncStorage.setItem(KEY_VOLUME, String(next));
}
