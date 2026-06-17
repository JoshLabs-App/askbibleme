import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clampShellChromeTune,
  DEFAULT_SHELL_CHROME_TUNE,
  type ShellChromeTune,
} from "../shell/chromeScrim";
import { NATURE_HOME_PREFS_KEYS, NATURE_HOME_PREFS_LEGACY_KEYS } from "./natureHomePrefsKeys";

export async function readShellChromeTune(): Promise<ShellChromeTune> {
  try {
    const raw =
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_KEYS.chromeTune)) ??
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_LEGACY_KEYS.chromeTune));
    if (!raw?.trim()) return DEFAULT_SHELL_CHROME_TUNE;
    await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.chromeTune, raw);
    await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.chromeTune);
    return clampShellChromeTune({ ...DEFAULT_SHELL_CHROME_TUNE, ...(JSON.parse(raw) as ShellChromeTune) });
  } catch {
    return DEFAULT_SHELL_CHROME_TUNE;
  }
}

export async function writeShellChromeTune(next: ShellChromeTune): Promise<void> {
  const normalized = clampShellChromeTune({ ...DEFAULT_SHELL_CHROME_TUNE, ...next });
  await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.chromeTune, JSON.stringify(normalized));
  await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.chromeTune);
}
