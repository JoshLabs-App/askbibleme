import {
  clampShellTemplateChromeTune,
  DEFAULT_SHELL_TEMPLATE_CHROME_TUNE,
  type ShellTemplateChromeTune,
} from "@/lib/shell/template-preview-themes";

/** 顶/底压边 tune；UI 消费请走 `useShellChromeScrimVisuals`（与 `shellTemplateChromeScrimBackgrounds` 成对），勿在各页重复拼渐变。 */

export const SHELL_TEMPLATE_CHROME_TUNE_STORAGE_KEY = "selah.shell-template-chrome-tune-v1";

const TUNE_CHANGE_EVENT = "selah-shell-template-chrome-tune";

/**
 * `useSyncExternalStore` 要求 getSnapshot 在存储未变时返回 **同一引用**；
 * 若每次 JSON 解析都 `new` 对象，会触发「The result of getSnapshot should be cached」无限循环。
 */
let snapshotRaw: string | undefined = undefined;
let snapshotTune: ShellTemplateChromeTune = DEFAULT_SHELL_TEMPLATE_CHROME_TUNE;

function mergeWithDefaults(raw: unknown): ShellTemplateChromeTune {
  const base = { ...DEFAULT_SHELL_TEMPLATE_CHROME_TUNE };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  (Object.keys(base) as (keyof ShellTemplateChromeTune)[]).forEach((k) => {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      (base as Record<string, number>)[k] = v;
    }
  });
  return clampShellTemplateChromeTune(base);
}

/** SSR / 无 window 时返回内置默认（与未保存一致） */
export function readShellTemplateChromeTuneFromStorage(): ShellTemplateChromeTune {
  if (typeof window === "undefined") return DEFAULT_SHELL_TEMPLATE_CHROME_TUNE;
  try {
    const raw = window.localStorage.getItem(SHELL_TEMPLATE_CHROME_TUNE_STORAGE_KEY);
    const key = raw ?? "";
    if (key === snapshotRaw) return snapshotTune;
    snapshotRaw = key;
    if (!key.trim()) {
      snapshotTune = DEFAULT_SHELL_TEMPLATE_CHROME_TUNE;
      return snapshotTune;
    }
    snapshotTune = mergeWithDefaults(JSON.parse(key) as unknown);
    return snapshotTune;
  } catch {
    snapshotTune = DEFAULT_SHELL_TEMPLATE_CHROME_TUNE;
    return snapshotTune;
  }
}

export function writeShellTemplateChromeTuneToStorage(tune: ShellTemplateChromeTune): void {
  if (typeof window === "undefined") return;
  const clamped = clampShellTemplateChromeTune(tune);
  const json = JSON.stringify(clamped);
  window.localStorage.setItem(SHELL_TEMPLATE_CHROME_TUNE_STORAGE_KEY, json);
  snapshotRaw = json;
  snapshotTune = clamped;
  window.dispatchEvent(new Event(TUNE_CHANGE_EVENT));
}

export function subscribeShellTemplateChromeTune(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === SHELL_TEMPLATE_CHROME_TUNE_STORAGE_KEY || e.key === null) onStoreChange();
  };
  const onLocal = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(TUNE_CHANGE_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(TUNE_CHANGE_EVENT, onLocal);
  };
}
