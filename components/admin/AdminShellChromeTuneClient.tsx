"use client";

import { useCallback, useRef, useState } from "react";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { ShellTemplateDesignReference } from "@/components/shell/ShellTemplateDesignReference";
import { ShellTemplateChromeTuningPanel } from "@/components/shell/ShellTemplateChromeTuningPanel";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import {
  readShellTemplateChromeTuneFromStorage,
  writeShellTemplateChromeTuneToStorage,
} from "@/lib/shell/shell-template-chrome-tune-storage";
import {
  clampShellTemplateChromeTune,
  DEFAULT_SHELL_TEMPLATE_CHROME_TUNE,
  type ShellTemplatePreviewThemeId,
  type ShellTemplateChromeTune,
} from "@/lib/shell/template-preview-themes";

export function AdminShellChromeTuneClient() {
  const { t } = useLocale();
  const { shellTemplateBrand, setShellTemplateBrand } = useAppSkin();
  const previewRootRef = useRef<HTMLDivElement>(null);
  const previewThemeId = (shellTemplateBrand ?? "parchmentShell") as ShellTemplatePreviewThemeId;

  const [chromeTune, setChromeTune] = useState<ShellTemplateChromeTune>(() =>
    readShellTemplateChromeTuneFromStorage(),
  );
  const [saveFlash, setSaveFlash] = useState(false);

  const handleSave = useCallback(() => {
    writeShellTemplateChromeTuneToStorage(chromeTune);
    setSaveFlash(true);
    window.setTimeout(() => setSaveFlash(false), 2200);
  }, [chromeTune]);

  const handleReset = useCallback(() => {
    const next = { ...DEFAULT_SHELL_TEMPLATE_CHROME_TUNE };
    setChromeTune(next);
    writeShellTemplateChromeTuneToStorage(next);
  }, []);

  return (
    <div className={`${ADMIN_MAIN_CLASS} max-w-none`}>
      <header className="mb-8 max-w-2xl space-y-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-adminFg">
          {t("admin.shellChrome.pageTitle")}
        </h1>
        <p className="text-[13px] leading-relaxed text-adminMuted">{t("admin.shellChrome.intro")}</p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 max-w-xl lg:max-w-none">
          <ShellTemplateChromeTuningPanel
            value={chromeTune}
            onChange={(n) => setChromeTune(clampShellTemplateChromeTune(n))}
            onSave={handleSave}
            onResetToDefaults={handleReset}
            saveFlash={saveFlash}
          />
        </div>

        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-adminFg">
            {t("admin.shellChrome.previewHeading")}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-adminMuted">{t("admin.shellChrome.previewHint")}</p>
          <div className="mt-3 flex h-[min(72vh,680px)] min-h-[400px] flex-col overflow-hidden rounded-xl border border-adminLine bg-adminPanel p-1 shadow-sm sm:p-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-adminBg">
              <ShellTemplateChromeLayout
                embedPreview
                chromeTune={chromeTune}
                contentClassName="gap-5"
                sampleRootRef={previewRootRef}
              >
                <ShellTemplateDesignReference
                  sampleRootRef={previewRootRef}
                  previewThemeId={previewThemeId}
                  onPreviewThemeId={setShellTemplateBrand}
                />
              </ShellTemplateChromeLayout>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto mt-12 max-w-6xl space-y-6 border-t border-adminLine/50 pt-8">
        <header className="space-y-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-adminFg">
            {t("admin.shellChrome.templateMovedBlockTitle")}
          </h2>
          <p className="text-[12px] leading-relaxed text-adminMuted">{t("admin.shellChrome.templateMovedBlockIntro")}</p>
        </header>

        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-adminMuted">
            {t("shellTemplatePage.previewThemesHeading")}
          </h3>
          <p className="text-[13px] leading-relaxed text-adminMuted">{t("shellTemplatePage.previewThemesHint")}</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-[15px] font-semibold tracking-tight text-adminFg">{t("shellTemplatePage.tokensHeading")}</h3>
          <p className="text-[13px] leading-relaxed text-adminMuted">{t("shellTemplatePage.tokensIntro")}</p>
        </div>
      </section>
    </div>
  );
}
