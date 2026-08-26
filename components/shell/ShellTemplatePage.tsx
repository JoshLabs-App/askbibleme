"use client";

import { useRef, useState } from "react";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { ShellTemplateDesignReference } from "@/components/shell/ShellTemplateDesignReference";
import type { ShellTemplatePreviewThemeId } from "@/lib/shell/template-preview-themes";

/**
 * 壳层模板页：与 `(app-shell)` 同源；主区浅色、通栏宽。
 * 壳层样式由 `ShellTemplateChromeLayout` 统一提供（压边参数读 `localStorage`，在管理后台「系统 → 壳层压边」调节）。
 */
export function ShellTemplatePage() {
  const [previewThemeId, setPreviewThemeId] = useState<ShellTemplatePreviewThemeId>("parchmentShell");
  const previewRootRef = useRef<HTMLDivElement>(null);

  return (
    <ShellTemplateChromeLayout contentClassName="gap-6" sampleRootRef={previewRootRef}>
      <ShellTemplateDesignReference
        sampleRootRef={previewRootRef}
        previewThemeId={previewThemeId}
        onPreviewThemeId={setPreviewThemeId}
      />
    </ShellTemplateChromeLayout>
  );
}
