import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PrayerMemoryRowV1 } from "./types";
import { HOME_VERSE_POOL_SCOPE_ID } from "./chunk-registry.generated";

const STORAGE_KEY = "askbible-mobile-home-verse-memory-v1";

type Stored = {
  version: 1;
  scopeId: string;
  memory: Record<string, PrayerMemoryRowV1>;
};

export async function readHomeVerseMemory(): Promise<Record<string, PrayerMemoryRowV1>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return {};
    const j = JSON.parse(raw) as Stored;
    if (j?.version !== 1 || j.scopeId !== HOME_VERSE_POOL_SCOPE_ID) return {};
    return j.memory && typeof j.memory === "object" ? j.memory : {};
  } catch {
    return {};
  }
}

export async function writeHomeVerseMemory(memory: Record<string, PrayerMemoryRowV1>): Promise<void> {
  try {
    const payload: Stored = { version: 1, scopeId: HOME_VERSE_POOL_SCOPE_ID, memory };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}
