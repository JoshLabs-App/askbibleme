"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { useNatureGoldenVerseAudioControl } from "@/hooks/useNatureGoldenVerseAudioControl";

type Props = {
  verseKey?: string | null;
  variant?: "standalone" | "transport";
};

/**
 * 首页底区：连续播放固定经文流；当前录音结束后立即进入下一节。
 * `transport` 变体仅渲染隐藏 `<audio>`，供 `NatureHomeAlbumStrip` 驱动。
 */
export function NatureGoldenVerseAudioControl({ verseKey, variant = "standalone" }: Props) {
  const { locale } = useLocale();
  const { src, ready, active, toggle, audioRef } = useNatureGoldenVerseAudioControl(verseKey);
  const zh = locale === "zh-CN" || locale === "zh-TW";

  if (variant === "transport") {
    return <audio ref={audioRef} src={src ?? undefined} className="hidden" playsInline preload="metadata" aria-hidden />;
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-pressed={active}
        aria-label={
          src
            ? active
              ? zh
                ? "暂停金句音频"
                : "Pause verse audio"
              : zh
                ? "播放金句音频"
                : "Play verse audio"
            : zh
              ? "当前没有可播放的金句音频"
              : "No verse audio available"
        }
        className={[
          "nature-home-audio-control",
          active ? "nature-home-audio-control--verse-active" : "",
        ].filter(Boolean).join(" ")}
        style={{ opacity: ready && src ? 1 : 0.24 }}
      >
        <ShellMaterialCommunityIcon
          name="account-voice"
          size={33}
          color={active ? "var(--brand-logo-background)" : "rgba(255,255,255,0.9)"}
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
        />
      </button>

      <audio ref={audioRef} src={src ?? undefined} className="hidden" playsInline preload="metadata" aria-hidden />
    </>
  );
}

/** 供首页专辑条使用的金句 transport 状态 */
export function useNatureGoldenVerseTransport(verseKey?: string | null) {
  return useNatureGoldenVerseAudioControl(verseKey);
}
