"use client";

import { useRef } from "react";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { ShellTemplateDesignReference } from "@/components/shell/ShellTemplateDesignReference";
import { useAppSkin } from "@/components/theme/AppSkinProvider";

/**
 * 壳层模板页：与 `(app-shell)` 同源；主区浅色、通栏宽。
 * 壳层样式由 `ShellTemplateChromeLayout` 统一提供（压边参数读 `localStorage`，在管理后台「系统 → 壳层压边」调节）。
 */
export function ShellTemplatePage() {
  const { shellTemplateBrand, setShellTemplateBrand } = useAppSkin();
  const previewThemeId = shellTemplateBrand ?? "parchmentShell";
  const previewRootRef = useRef<HTMLDivElement>(null);

  return (
    <ShellTemplateChromeLayout contentClassName="gap-6" sampleRootRef={previewRootRef}>
      <ShellTemplateDesignReference
        sampleRootRef={previewRootRef}
        previewThemeId={previewThemeId}
        onPreviewThemeId={setShellTemplateBrand}
      />
    </ShellTemplateChromeLayout>
  );
}
