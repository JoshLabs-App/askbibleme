import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clampBirthDate,
  clampBirthDateToToday,
  defaultBirthDate,
  isValidBirthDate,
  type ExploreBirthDate,
} from "./explore-birth-date";

const STORAGE_KEY_V1 = "askbible-explore-birth-year-v1";
const STORAGE_KEY = "askbible-explore-birth-date-v1";
const STORAGE_KEY_V1_LEGACY = "selah-explore-birth-year-v1";
const STORAGE_KEY_LEGACY = "selah-explore-birth-date-v1";

const DISPLAY_NAME_MAX_LEN = 24;

export type ExploreYearDayProfile = {
  birthDate: ExploreBirthDate | null;
  displayName: string | null;
  weddingAnniversary: ExploreBirthDate | null;
  baptismDate: ExploreBirthDate | null;
};

const EMPTY_PROFILE: ExploreYearDayProfile = {
  birthDate: null,
  displayName: null,
  weddingAnniversary: null,
  baptismDate: null,
};

function parseStoredOptionalDate(
  parsed: Record<string, unknown>,
  prefix: "wedding" | "baptism",
): ExploreBirthDate | null {
  const year = parsed[`${prefix}Year`];
  const month = parsed[`${prefix}Month`];
  const day = parsed[`${prefix}Day`];
  if (year == null || month == null || day == null) return null;
  const d: ExploreBirthDate = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
  return isValidBirthDate(d) ? d : null;
}

function isValidBirthYearOnly(year: number, nowYear = new Date().getFullYear()): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= nowYear;
}

export function normalizeExploreDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isValidExploreDisplayName(raw: string): boolean {
  const name = normalizeExploreDisplayName(raw);
  return name.length > 0 && name.length <= DISPLAY_NAME_MAX_LEN;
}

function parseStoredDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = normalizeExploreDisplayName(raw);
  return isValidExploreDisplayName(name) ? name : null;
}

function parseStoredProfile(raw: string): ExploreYearDayProfile {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const d: ExploreBirthDate = {
      year: Number(parsed.year),
      month: Number(parsed.month),
      day: Number(parsed.day),
    };
    return {
      birthDate: isValidBirthDate(d) ? d : null,
      displayName: parseStoredDisplayName(parsed.name),
      weddingAnniversary: parseStoredOptionalDate(parsed, "wedding"),
      baptismDate: parseStoredOptionalDate(parsed, "baptism"),
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function isExploreYearDayProfileComplete(profile: ExploreYearDayProfile): boolean {
  return profile.birthDate != null && profile.displayName != null;
}

function appendOptionalDate(
  payload: Record<string, number | string>,
  prefix: "wedding" | "baptism",
  date: ExploreBirthDate | null | undefined,
): void {
  if (!date) return;
  const clamped = clampBirthDateToToday(clampBirthDate(date));
  if (!isValidBirthDate(clamped)) return;
  payload[`${prefix}Year`] = clamped.year;
  payload[`${prefix}Month`] = clamped.month;
  payload[`${prefix}Day`] = clamped.day;
}

async function migrateV1YearIfPresent(): Promise<ExploreBirthDate | null> {
  try {
    const raw =
      (await AsyncStorage.getItem(STORAGE_KEY_V1)) ??
      (await AsyncStorage.getItem(STORAGE_KEY_V1_LEGACY));
    if (!raw) return null;
    const year = Number.parseInt(raw, 10);
    if (!isValidBirthYearOnly(year)) {
      await AsyncStorage.multiRemove([STORAGE_KEY_V1, STORAGE_KEY_V1_LEGACY]);
      return null;
    }
    const migrated = clampBirthDate({ year, month: 1, day: 1 });
    await writeExploreBirthDate(migrated);
    await AsyncStorage.multiRemove([STORAGE_KEY_V1, STORAGE_KEY_V1_LEGACY]);
    return migrated;
  } catch {
    return null;
  }
}

export async function readExploreYearDayProfile(): Promise<ExploreYearDayProfile> {
  try {
    const raw =
      (await AsyncStorage.getItem(STORAGE_KEY)) ??
      (await AsyncStorage.getItem(STORAGE_KEY_LEGACY));
    if (raw) {
      await AsyncStorage.setItem(STORAGE_KEY, raw);
      await AsyncStorage.multiRemove([STORAGE_KEY_LEGACY, STORAGE_KEY_V1_LEGACY]);
      const profile = parseStoredProfile(raw);
      if (profile.birthDate) return profile;
    }
    const migrated = await migrateV1YearIfPresent();
    if (migrated) return { ...EMPTY_PROFILE, birthDate: migrated };
    return { ...EMPTY_PROFILE };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export async function readExploreDisplayName(): Promise<string | null> {
  const profile = await readExploreYearDayProfile();
  return profile.displayName;
}

export async function readExploreBirthDate(): Promise<ExploreBirthDate | null> {
  const profile = await readExploreYearDayProfile();
  return profile.birthDate;
}

export async function writeExploreYearDayProfile(profile: {
  birthDate: ExploreBirthDate;
  displayName: string;
  weddingAnniversary?: ExploreBirthDate | null;
  baptismDate?: ExploreBirthDate | null;
}): Promise<void> {
  const clamped = clampBirthDateToToday(clampBirthDate(profile.birthDate));
  const name = normalizeExploreDisplayName(profile.displayName);
  if (!isValidBirthDate(clamped) || !isValidExploreDisplayName(name)) return;

  const payload: Record<string, number | string> = {
    ...clamped,
    name,
  };
  appendOptionalDate(payload, "wedding", profile.weddingAnniversary);
  appendOptionalDate(payload, "baptism", profile.baptismDate);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  await AsyncStorage.multiRemove([STORAGE_KEY_LEGACY, STORAGE_KEY_V1, STORAGE_KEY_V1_LEGACY]);
}

export async function writeExploreBirthDate(date: ExploreBirthDate): Promise<void> {
  const clamped = clampBirthDateToToday(clampBirthDate(date));
  if (!isValidBirthDate(clamped)) return;
  const existing = await readExploreYearDayProfile();
  if (existing.displayName) {
    await writeExploreYearDayProfile({
      birthDate: clamped,
      displayName: existing.displayName,
      weddingAnniversary: existing.weddingAnniversary,
      baptismDate: existing.baptismDate,
    });
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
  await AsyncStorage.multiRemove([STORAGE_KEY_LEGACY, STORAGE_KEY_V1, STORAGE_KEY_V1_LEGACY]);
}

export async function clearExploreBirthDate(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_KEY_V1, STORAGE_KEY_LEGACY, STORAGE_KEY_V1_LEGACY]);
}

/** @deprecated 仅取年份；新代码请用 readExploreBirthDate */
export async function readExploreBirthYear(): Promise<number | null> {
  const d = await readExploreBirthDate();
  return d?.year ?? null;
}

/** @deprecated 仅写年份（月日置 1 月 1 日） */
export async function writeExploreBirthYear(year: number): Promise<void> {
  if (!isValidBirthYearOnly(year)) return;
  await writeExploreBirthDate(clampBirthDate({ year, month: 1, day: 1 }));
}

export async function clearExploreBirthYear(): Promise<void> {
  await clearExploreBirthDate();
}

export { defaultBirthDate };
