import * as Clipboard from "expo-clipboard";
import { TurboModuleRegistry } from "react-native";
import { formatScriptureVerseClipboard } from "./format-scripture-verse-clipboard";

type VerseClipboardRef = {
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
};

type ExpoClipboardNative = {
  setStringAsync?: (text: string) => Promise<boolean>;
  setString?: (text: string) => void;
};

type ExpoHostGlobal = typeof globalThis & {
  expo?: { modules?: Record<string, ExpoClipboardNative | undefined> };
};

let clipboardNative: ExpoClipboardNative | null | undefined;
let clipboardProbeDone = false;

function isUsableClipboard(mod: ExpoClipboardNative | null | undefined): mod is ExpoClipboardNative {
  return Boolean(mod?.setStringAsync || mod?.setString);
}

/** 静默探测；勿用 `requireOptionalNativeModule`（缺失时会 console.warn → LogBox 黄条） */
function getExpoClipboardNative(): ExpoClipboardNative | null {
  if (clipboardProbeDone) return clipboardNative ?? null;
  clipboardProbeDone = true;

  const fromHost = (globalThis as ExpoHostGlobal).expo?.modules?.ExpoClipboard;
  if (isUsableClipboard(fromHost)) {
    clipboardNative = fromHost;
    return clipboardNative;
  }

  try {
    const turbo = TurboModuleRegistry.get("ExpoClipboard") as ExpoClipboardNative | null | undefined;
    if (isUsableClipboard(turbo)) {
      clipboardNative = turbo;
      return clipboardNative;
    }
  } catch {
    /* 当前 dev build 未编入 ExpoClipboard */
  }

  clipboardNative = null;
  return null;
}

/** 收藏时复制经文；原生模块不可用时静默失败 */
export async function copyScriptureVerseToClipboard(ref: VerseClipboardRef): Promise<boolean> {
  const payload = formatScriptureVerseClipboard(ref);
  try {
    await Clipboard.setStringAsync(payload);
    return true;
  } catch {
    /* fallback to native probing below */
  }
  const native = getExpoClipboardNative();
  if (!native) return false;
  try {
    if (native.setStringAsync) {
      await native.setStringAsync(payload);
      return true;
    }
    if (native.setString) {
      native.setString(payload);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 通用文本复制；原生剪贴板不可用时返回 false（静默）。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const payload = text.trim();
  if (!payload) return false;
  try {
    await Clipboard.setStringAsync(payload);
    return true;
  } catch {
    /* fallback to native probing below */
  }
  const native = getExpoClipboardNative();
  if (!native) return false;
  try {
    if (native.setStringAsync) {
      await native.setStringAsync(payload);
      return true;
    }
    if (native.setString) {
      native.setString(payload);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
