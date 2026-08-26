"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

type Props = {
  locale: AppLocale;
  value: number;
  max: number;
  onChange: (next: number) => void;
};

export function ReadingPlanStartDayPicker({ locale, value, max, onChange }: Props) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(1, Math.floor(n)));

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      onChange(1);
      setText("1");
      return;
    }
    const next = clamp(n);
    onChange(next);
    setText(String(next));
  };

  const step = (delta: number) => {
    const next = clamp(value + delta);
    onChange(next);
    setText(String(next));
  };

  return (
    <section className="reading-planner-start-day">
      <h3 className="reading-planner-start-day__title">
        {locale === "en" ? "Start from which day?" : zhText("从第几天开始读？")}
      </h3>
      <p className="reading-planner-start-day__hint">
        {locale === "en"
          ? "New here? Leave it at day 1. Already partway through—say day 20—set it here to pick up where you left off."
          : zhText("第一次读，保持第 1 天即可；若之前已读到第 20 天，可直接设为 20，从那里继续。")}
      </p>
      <div className="reading-planner-start-day__row">
        <button
          type="button"
          disabled={value <= 1}
          aria-label={locale === "en" ? "Decrease start day" : zhText("减少起始天数")}
          className="reading-planner-start-day__step"
          onClick={() => step(-1)}
        >
          <ShellMaterialCommunityIcon name="minus" size={22} color="#2b1d15" />
        </button>
        <div className="reading-planner-start-day__value">
          <span className="reading-planner-start-day__prefix">
            {locale === "en" ? "Day" : zhText("第")}
          </span>
          <input
            value={text}
            inputMode="numeric"
            aria-label={locale === "en" ? "Start day" : zhText("起始天数")}
            className="reading-planner-start-day__input"
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => commit(text)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(text);
            }}
          />
          {locale === "en" ? null : (
            <span className="reading-planner-start-day__prefix">{zhText("天")}</span>
          )}
        </div>
        <button
          type="button"
          disabled={value >= max}
          aria-label={locale === "en" ? "Increase start day" : zhText("增加起始天数")}
          className="reading-planner-start-day__step"
          onClick={() => step(1)}
        >
          <ShellMaterialCommunityIcon name="plus" size={22} color="#2b1d15" />
        </button>
      </div>
    </section>
  );
}
