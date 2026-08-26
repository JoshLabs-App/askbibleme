import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_LOCALE,
  inferAppLocaleFromDevice,
  LOCALE_STORAGE_KEY,
  LOCALE_STORAGE_KEY_LEGACY,
  parseLocale,
  type AppLocale,
} from "./config";

let locale: AppLocale = DEFAULT_LOCALE;
let hydrated = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function getLocale(): AppLocale {
  return locale;
}

export function isLocaleHydrated(): boolean {
  return hydrated;
}

export function subscribeLocale(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export async function hydrateLocaleFromStorage(): Promise<AppLocale> {
  try {
    const raw =
      (await AsyncStorage.getItem(LOCALE_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(LOCALE_STORAGE_KEY_LEGACY));
    if (raw) {
      locale = parseLocale(raw);
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
      await AsyncStorage.removeItem(LOCALE_STORAGE_KEY_LEGACY);
    } else {
      locale = inferAppLocaleFromDevice();
    }
  } catch {
    locale = DEFAULT_LOCALE;
  }
  hydrated = true;
  emit();
  return locale;
}

export async function setLocale(next: AppLocale): Promise<void> {
  if (next === locale) return;
  locale = next;
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
    await AsyncStorage.removeItem(LOCALE_STORAGE_KEY_LEGACY);
  } catch {
    /* ignore */
  }
  emit();
}
