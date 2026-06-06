import {
  clampBirthDate,
  clampBirthDateToToday,
  defaultBirthDate,
  isValidBirthDate,
  type ExploreBirthDate,
} from "./explore-birth-date";

const STORAGE_KEY = "askbible-explore-birth-date-v1";
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

export function normalizeExploreDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isValidExploreDisplayName(raw: string): boolean {
  const name = normalizeExploreDisplayName(raw);
  return name.length > 0 && name.length <= DISPLAY_NAME_MAX_LEN;
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
      displayName:
        typeof parsed.name === "string" && isValidExploreDisplayName(parsed.name)
          ? normalizeExploreDisplayName(parsed.name)
          : null,
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

export function readExploreYearDayProfile(): ExploreYearDayProfile {
  if (typeof window === "undefined") return { ...EMPTY_PROFILE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw) return { ...EMPTY_PROFILE };
    localStorage.setItem(STORAGE_KEY, raw);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    return parseStoredProfile(raw);
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function writeExploreYearDayProfile(profile: {
  birthDate: ExploreBirthDate;
  displayName: string;
  weddingAnniversary?: ExploreBirthDate | null;
  baptismDate?: ExploreBirthDate | null;
}): void {
  const clamped = clampBirthDateToToday(clampBirthDate(profile.birthDate));
  const name = normalizeExploreDisplayName(profile.displayName);
  if (!isValidBirthDate(clamped) || !isValidExploreDisplayName(name)) return;

  const payload: Record<string, number | string> = {
    ...clamped,
    name,
  };
  appendOptionalDate(payload, "wedding", profile.weddingAnniversary);
  appendOptionalDate(payload, "baptism", profile.baptismDate);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  localStorage.removeItem(STORAGE_KEY_LEGACY);
}

export { defaultBirthDate };
