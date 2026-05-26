import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "askbible.mobile.update-announcement-prefs.v1";

type AnnouncementPrefs = {
  dismissedIds: string[];
  snoozeUntilById: Record<string, number>;
};

const EMPTY_PREFS: AnnouncementPrefs = {
  dismissedIds: [],
  snoozeUntilById: {},
};

async function readPrefs(): Promise<AnnouncementPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<AnnouncementPrefs>;
    return {
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : [],
      snoozeUntilById:
        parsed.snoozeUntilById && typeof parsed.snoozeUntilById === "object"
          ? Object.fromEntries(
              Object.entries(parsed.snoozeUntilById).filter(
                ([id, at]) => id.trim().length > 0 && Number.isFinite(Number(at)),
              ),
            )
          : {},
    };
  } catch {
    return EMPTY_PREFS;
  }
}

async function writePrefs(next: AnnouncementPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore persistence failures */
  }
}

export async function shouldShowUpdateAnnouncement(announcementId: string): Promise<boolean> {
  const id = announcementId.trim();
  if (!id) return false;
  const prefs = await readPrefs();
  if (prefs.dismissedIds.includes(id)) return false;
  const snoozeUntil = Number(prefs.snoozeUntilById[id] ?? 0);
  if (Number.isFinite(snoozeUntil) && snoozeUntil > Date.now()) return false;
  return true;
}

export async function dismissUpdateAnnouncementForever(announcementId: string): Promise<void> {
  const id = announcementId.trim();
  if (!id) return;
  const prefs = await readPrefs();
  const dismissed = new Set(prefs.dismissedIds);
  dismissed.add(id);
  const next: AnnouncementPrefs = {
    dismissedIds: [...dismissed],
    snoozeUntilById: {
      ...prefs.snoozeUntilById,
      [id]: Number.MAX_SAFE_INTEGER,
    },
  };
  await writePrefs(next);
}

export async function snoozeUpdateAnnouncement(
  announcementId: string,
  hours: number,
): Promise<void> {
  const id = announcementId.trim();
  if (!id) return;
  const safeHours = Number.isFinite(hours) ? Math.max(1, Math.min(24 * 30, Math.floor(hours))) : 24;
  const prefs = await readPrefs();
  const next: AnnouncementPrefs = {
    ...prefs,
    snoozeUntilById: {
      ...prefs.snoozeUntilById,
      [id]: Date.now() + safeHours * 60 * 60 * 1000,
    },
  };
  await writePrefs(next);
}

