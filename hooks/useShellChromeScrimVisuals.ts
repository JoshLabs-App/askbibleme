"use client";

import { useMemo } from "react";
import { useShellTemplateChromeTuneFromStorage } from "@/hooks/useShellTemplateChromeTuneFromStorage";
import {
  shellChromeBottomLayerStyleForAppShellMain,
  shellChromeBottomLayerStyleForNatureVideoStage,
  shellChromeTopLayerStyle,
  shellTemplateChromeScrimBackgrounds,
  type ShellTemplateChromeTune,
} from "@/lib/shell/template-preview-themes";

/**
 * 顶/底压边：与 `shellTemplateChromeScrimBackgrounds` + `localStorage`（管理后台「壳层压边」保存）同源。
 * 传 `tuneOverride` 时用于受控预览；否则读全站已存 tune。
 */
export function useShellChromeScrimVisuals(
  appLightHex: string,
  appDarkHex: string,
  tuneOverride?: ShellTemplateChromeTune,
  options?: { shellMainBottomScrim?: "dock" | "contained" },
) {
  const persistedTune = useShellTemplateChromeTuneFromStorage();
  const tune = tuneOverride !== undefined ? tuneOverride : persistedTune;
  const shellMainBottomScrim = options?.shellMainBottomScrim ?? "dock";

  const chrome = useMemo(
    () => shellTemplateChromeScrimBackgrounds(appLightHex, appDarkHex, tune),
    [appLightHex, appDarkHex, tune],
  );

  const topLayerStyle = useMemo(() => shellChromeTopLayerStyle(chrome, tune), [chrome, tune]);

  const bottomLayerStyleAppShellMain = useMemo(
    () => shellChromeBottomLayerStyleForAppShellMain(chrome, tune),
    [chrome, tune],
  );

  /** 与 `shellChromeBottomLayerStyleForNatureVideoStage` 相同：主区 `relative` 内 `absolute bottom` 用 */
  const bottomLayerStyleShellMainContained = useMemo(
    () => shellChromeBottomLayerStyleForNatureVideoStage(chrome, tune),
    [chrome, tune],
  );

  const bottomLayerStyleShellTemplateMain = useMemo(
    () =>
      shellMainBottomScrim === "contained"
        ? bottomLayerStyleShellMainContained
        : bottomLayerStyleAppShellMain,
    [shellMainBottomScrim, bottomLayerStyleShellMainContained, bottomLayerStyleAppShellMain],
  );

  const bottomLayerStyleNatureVideoStage = bottomLayerStyleShellMainContained;

  return {
    chrome,
    tune,
    topLayerStyle,
    bottomLayerStyleAppShellMain,
    bottomLayerStyleNatureVideoStage,
    bottomLayerStyleShellTemplateMain,
  };
}
