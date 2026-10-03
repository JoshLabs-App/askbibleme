"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";

type Props = {
  open: boolean;
  /** 环境音开着时也点亮（安卓 `HomeScreen` 的 `settingsLit`） */
  ambientActive: boolean;
  onToggle: () => void;
};

/**
 * 自然首页右上角齿轮：和安卓 `HomeScreen` 一样，点一下在底部展开 / 收起
 * 「字号与定时 · 环境音 · 场景」三排；展开或环境音开着时亮 LOGO 黄。
 */
export function NatureHomeToolsToggle({ open, ambientActive, onToggle }: Props) {
  const { locale } = useLocale();
  const zh = locale === "zh-CN" || locale === "zh-TW";
  const lit = open || ambientActive;
  const label = open
    ? zh
      ? locale === "zh-TW"
        ? "收起場景與音效"
        : "收起场景与音效"
      : "Hide scenes and sounds"
    : zh
      ? locale === "zh-TW"
        ? "場景與音效"
        : "场景与音效"
      : "Scenes and sounds";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      className="nature-home-tools-toggle touch-manipulation inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-white transition active:scale-[0.97]"
      style={{ width: 50, height: 50 }}
    >
      <ShellMaterialIcon
        name="settings"
        size={28}
        color={lit ? "var(--brand-logo-background)" : "#FFFFFF"}
        legibilityShadow
      />
    </button>
  );
}
