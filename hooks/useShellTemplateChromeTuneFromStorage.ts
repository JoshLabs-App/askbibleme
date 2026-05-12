"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_SHELL_TEMPLATE_CHROME_TUNE,
  type ShellTemplateChromeTune,
} from "@/lib/shell/template-preview-themes";
import {
  readShellTemplateChromeTuneFromStorage,
  subscribeShellTemplateChromeTune,
} from "@/lib/shell/shell-template-chrome-tune-storage";

/** 与 `localStorage` 同步；同页保存或其它标签 `storage` 变化时更新 */
export function useShellTemplateChromeTuneFromStorage(): ShellTemplateChromeTune {
  return useSyncExternalStore(
    subscribeShellTemplateChromeTune,
    readShellTemplateChromeTuneFromStorage,
    () => DEFAULT_SHELL_TEMPLATE_CHROME_TUNE,
  );
}
