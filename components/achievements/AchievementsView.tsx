"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MedalIcon } from "@/components/achievements/MedalIcon";
import { XPBar, useAchievementSnapshot } from "@/components/achievements/XPBar";
import { medalCondition, medalText } from "@/components/achievements/achievement-text";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { achCopy } from "@/lib/achievements/achievement-copy";
import {
  MEDAL_CATALOG,
  sealKeyForBookNumber,
  type MedalDef,
} from "@/lib/achievements/medal-catalog";
import {
  achievementSoundEnabled,
  playAchievementCue,
  setAchievementSoundEnabled,
} from "@/lib/achievements/achievement-feedback-web";
import { metricValue, type MedalEarned } from "@/lib/achievements/achievement-store-web";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

function pickCopy(zh: string, en: string, locale: string): string {
  if (locale === "en") return en;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

/**
 * 书卷印鉴墙（对齐去游戏化后的 iOS / Android AchievementsView）：
 * 前置 66 卷书卷火漆印浮雕墙，下方附安静阅读纪念章与读完章小钵提示音开关；移除总 XP 与连击倍率。
 */
export function AchievementsView() {
  const { locale } = useLocale();
  const snap = useAchievementSnapshot();
  const sealCount = Object.keys(snap.seals).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 text-[#231A12] dark:text-[#EDE2CF]">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            aria-label={locale === "en" ? "Back" : "返回"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DFD0B8] bg-[#FAF5EC] text-[#231A12] no-underline dark:border-[#3E3328] dark:bg-[#262019] dark:text-[#EDE2CF]"
          >
            ‹
          </Link>
          <h1 className="m-0 text-[19px] font-bold">
            {pickCopy(`书卷印鉴 · ${sealCount} / 66 卷`, `Book Seals · ${sealCount} / 66`, locale)}
          </h1>
        </div>

        <section className="rounded-[20px] border border-[#D8C6AA] bg-[#FAF5EC]/92 p-4 dark:border-[#3E3328] dark:bg-[#262019]/92">
          <XPBar compact />
        </section>

        {/* 66 卷书卷火漆印前置展示 */}
        <section className="flex flex-col gap-3">
          <SectionTitle
            title={achCopy("native.bookSeals", locale)}
            sub={achCopy("native.sealsProgress", locale, { n: sealCount })}
          />
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", columnGap: 12, rowGap: 16 }}
          >
            {scriptureBooks.map((book) => {
              const key = sealKeyForBookNumber(book.bookNumber);
              const lit = snap.seals[book.bookId] != null;
              const name = getScriptureBookDisplayName(book.bookId, locale);
              return (
                <div key={book.bookId} className="flex flex-col items-center gap-1.5">
                  {key ? <MedalIcon imageKey={key} tier={lit ? 1 : 0} size={72} alt={name} /> : null}
                  <span
                    className="block w-full truncate text-center text-[12px]"
                    style={{
                      fontWeight: lit ? 600 : 400,
                      opacity: lit ? 1 : 0.62,
                    }}
                  >
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 阅读纪念章 */}
        <section className="flex flex-col gap-3">
          <SectionTitle
            title={pickCopy("阅读纪念章", "Reading Milestones", locale)}
            sub={achCopy("native.medalsProgress", locale, {
              n: Object.keys(snap.earned).length,
              total: MEDAL_CATALOG.length,
            })}
          />
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", columnGap: 14, rowGap: 18 }}
          >
            {MEDAL_CATALOG.map((def) => (
              <MedalCell
                key={def.key}
                def={def}
                earned={snap.earned[def.key]}
                current={metricValue(def.metric)}
                locale={locale}
              />
            ))}
          </div>
        </section>

        <SoundToggle locale={locale} />
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="m-0 text-[17px] font-bold">{title}</h2>
      <span className="text-[12px] tabular-nums text-[#75614B] dark:text-[#A99A84]">{sub}</span>
    </div>
  );
}

function MedalCell({
  def,
  earned,
  current,
  locale,
}: {
  def: MedalDef;
  earned: MedalEarned | undefined;
  current: number;
  locale: AppLocale;
}) {
  const tier = earned?.tier ?? 0;
  const next = tier < def.tiers.length ? def.tiers[tier] : null;
  const target = next ?? def.tiers[def.tiers.length - 1] ?? 1;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <MedalIcon
        imageKey={def.key}
        tier={tier}
        tierCount={def.tiers.length}
        size={68}
        alt={medalText(def.name, locale)}
      />
      <span
        className="block w-full truncate text-center text-[12px]"
        style={{ fontWeight: tier > 0 ? 600 : 400, opacity: tier > 0 ? 1 : 0.72 }}
      >
        {medalText(def.name, locale)}
      </span>
      <span className="block w-full truncate text-center text-[10.5px] tabular-nums text-[#75614B] dark:text-[#A99A84]">
        {next != null ? `${current} / ${next}` : medalCondition(def.condition, target, locale)}
      </span>
    </div>
  );
}

function SoundToggle({ locale }: { locale: AppLocale }) {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(achievementSoundEnabled()), []);

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#DFD0B8] bg-[#FAF5EC]/90 px-4 py-3 dark:border-[#3E3328] dark:bg-[#262019]/90">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{achCopy("native.achievementSound", locale)}</span>
        <span className="text-[12px] text-[#75614B] dark:text-[#A99A84]">
          {achCopy("native.achievementSoundHint", locale)}
        </span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          setAchievementSoundEnabled(next);
          if (next) playAchievementCue("chapter");
        }}
        style={{ width: 20, height: 20, accentColor: "#C1660B" }}
      />
    </label>
  );
}
