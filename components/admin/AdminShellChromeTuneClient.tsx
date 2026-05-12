"use client";

import { useCallback, useState } from "react";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellTemplateChromeTuningPanel } from "@/components/shell/ShellTemplateChromeTuningPanel";
import {
  readShellTemplateChromeTuneFromStorage,
  writeShellTemplateChromeTuneToStorage,
} from "@/lib/shell/shell-template-chrome-tune-storage";
import {
  clampShellTemplateChromeTune,
  DEFAULT_SHELL_TEMPLATE_CHROME_TUNE,
  type ShellTemplateChromeTune,
} from "@/lib/shell/template-preview-themes";

export function AdminShellChromeTuneClient() {
  const { t } = useLocale();
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
    <div className={ADMIN_MAIN_CLASS}>
      <header className="mb-8 max-w-2xl space-y-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-adminFg">
          {t("admin.shellChrome.pageTitle")}
        </h1>
        <p className="text-[13px] leading-relaxed text-adminMuted">{t("admin.shellChrome.intro")}</p>
      </header>
      <div className="max-w-xl">
        <ShellTemplateChromeTuningPanel
          value={chromeTune}
          onChange={(n) => setChromeTune(clampShellTemplateChromeTune(n))}
          onSave={handleSave}
          onResetToDefaults={handleReset}
          saveFlash={saveFlash}
        />
      </div>

      <section className="mt-10 max-w-2xl space-y-6 border-t border-adminLine/50 pt-8">
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
