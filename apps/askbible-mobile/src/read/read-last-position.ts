import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "askbible-mobile-read-last-v1";

export type ReadLastPosition = {
  bookId: string;
  chapter: number;
  bookName: string;
};

export async function readLastReadPosition(): Promise<ReadLastPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReadLastPosition;
    if (!parsed?.bookId || !Number.isInteger(parsed.chapter) || parsed.chapter < 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLastReadPosition(pos: ReadLastPosition): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(pos));
}
