"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import {
  NATURE_HOME_TEXT_SCALE_STEPS,
  readNatureHomeTextScaleStepIndex,
  writeNatureHomeTextScaleStepIndex,
} from "@/lib/home/nature-home-text-scale-prefs";
import { cycleShellSleepTimerMinutes } from "@/lib/music/shell-sleep-timer";

const IDLE = "rgba(255,255,255,0.78)";
const LOGO_COLOR = "var(--brand-logo-background)";
const ICON_SIZE = 26;

type Props = {
  prefsVersion: number;
  onPrefsChanged: () => void;
};

/** 首页底栏展开时：字号 −/+ 与睡眠定时（对齐 App `HomeVerseScaleTimerControl`） */
export function NatureHomeVerseScaleTimerControl({ prefsVersion, onPrefsChanged }: Props) {
  const { t } = useLocale();
  const { sleepTimerMinutes, setSleepTimerMinutes } = useMusicShellPlayback();
  const [scaleIndex, setScaleIndex] = useState(readNatureHomeTextScaleStepIndex());
  const atMin = scaleIndex <= 0;
  const atMax = scaleIndex >= NATURE_HOME_TEXT_SCALE_STEPS.length - 1;
  const timerOn = sleepTimerMinutes > 0;

  useEffect(() => {
    setScaleIndex(readNatureHomeTextScaleStepIndex());
  }, [prefsVersion]);

  const bumpScale = (delta: -1 | 1) => {
    const next = Math.max(0, Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, scaleIndex + delta));
    if (next === scaleIndex) return;
    setScaleIndex(next);
    writeNatureHomeTextScaleStepIndex(next);
    onPrefsChanged();
  };

  return (
    <div className="nature-home-scale-timer-row" data-shell-swipe-nav-exclude>
      <button
        type="button"
        disabled={atMin}
        aria-label={t("nature.textScaleSmallerAria")}
        className={["nature-home-scale-timer-btn", atMin ? "nature-home-scale-timer-btn--disabled" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => bumpScale(-1)}
      >
        <ShellMaterialIcon name="remove" size={ICON_SIZE} color={IDLE} />
      </button>
      <button
        type="button"
        disabled={atMax}
        aria-label={t("nature.textScaleLargerAria")}
        className={["nature-home-scale-timer-btn", atMax ? "nature-home-scale-timer-btn--disabled" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => bumpScale(1)}
      >
        <ShellMaterialIcon name="add" size={ICON_SIZE} color={IDLE} />
      </button>
      <button
        type="button"
        aria-pressed={timerOn}
        aria-label={
          timerOn
            ? t("music.sleepTimer.watchAria") + ` ${sleepTimerMinutes}`
            : t("nature.homeSettings.sleepSection")
        }
        className="nature-home-scale-timer-btn nature-home-scale-timer-btn--timer"
        onClick={() => setSleepTimerMinutes(cycleShellSleepTimerMinutes(sleepTimerMinutes))}
      >
        <ShellMaterialIcon name="timer" size={ICON_SIZE} color={timerOn ? LOGO_COLOR : IDLE} />
        {timerOn ? (
          <span className="nature-home-scale-timer-badge" aria-hidden>
            {String(sleepTimerMinutes)}
          </span>
        ) : null}
      </button>
    </div>
  );
}
