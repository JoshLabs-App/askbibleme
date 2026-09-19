"use client";

import Link from "next/link";
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
import { metricValue, type MedalEarned } from "@/lib/achievements/achievement-store-web";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { AppLocale } from "@/lib/i18n/config";

const INK = "#2B1D15";
const INK_SOFT = "#5C4030";
const MUTED = "#7A633A";
const TRACK = "#F2E4CF";
const SURFACE = "rgba(255,252,245,0.92)";

/**
 * 成就页（对齐 iOS `AchievementsView`）：顶上等级条 + 三个数字，中间勋章墙，下面 66 卷印章。
 * 未获得的也全部列出来（压暗 + 下一档进度）——看得见下一档才有奔头。
 */
export function AchievementsView() {
  const { locale } = useLocale();
  const snap = useAchievementSnapshot();

  return (
    <div className="mx-auto w-full max-w-3xl" style={{ padding: 18 }}>
      <div className="flex flex-col" style={{ gap: 22 }}>
        {/* 顶栏：iOS 那边是 inline 的导航标题 + 系统返回，网页端给同样的一行 */}
        <div className="flex items-center" style={{ gap: 10, marginBottom: -8 }}>
          <Link
            href="/explore"
            aria-label={locale === "en" ? "Back" : "返回"}
            className="no-underline"
            style={{ color: MUTED, fontSize: 18, lineHeight: 1 }}
          >
            ←
          </Link>
          <h1 className="m-0 font-bold" style={{ fontSize: 17, color: INK }}>
            {achCopy("native.achievements", locale)}
          </h1>
        </div>

        {/* 表头：等级条 + 三个数字 */}
        <section
          style={{ padding: 16, borderRadius: 18, backgroundColor: SURFACE, border: `1px solid ${TRACK}` }}
        >
          <div className="flex flex-col" style={{ gap: 14 }}>
            <XPBar />
            <div className="flex items-stretch">
              <Stat value={String(snap.totalXP)} label={achCopy("native.totalXP", locale)} />
              <Divider />
              <Stat
                value={String(snap.chaptersReadCount)}
                label={achCopy("native.chaptersReadLabel", locale)}
              />
              <Divider />
              <Stat
                value={`×${snap.streakMultiplier.toFixed(2)}`}
                label={achCopy("native.streakBonus", locale)}
              />
            </div>
          </div>
        </section>

        {/* 勋章墙 */}
        <section className="flex flex-col" style={{ gap: 12 }}>
          <SectionTitle
            title={achCopy("native.medals", locale)}
            sub={achCopy("native.medalsProgress", locale, {
              n: Object.keys(snap.earned).length,
              total: MEDAL_CATALOG.length,
            })}
          />
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", columnGap: 14, rowGap: 18 }}
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

        {/* 66 卷书卷印章 */}
        <section className="flex flex-col" style={{ gap: 12 }}>
          <SectionTitle
            title={achCopy("native.bookSeals", locale)}
            sub={achCopy("native.sealsProgress", locale, { n: Object.keys(snap.seals).length })}
          />
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", columnGap: 10, rowGap: 14 }}
          >
            {scriptureBooks.map((book) => {
              const key = sealKeyForBookNumber(book.bookNumber);
              const lit = snap.seals[book.bookId] != null;
              const name = getScriptureBookDisplayName(book.bookId, locale);
              return (
                <div key={book.bookId} className="flex flex-col items-center" style={{ gap: 4 }}>
                  {key ? <MedalIcon imageKey={key} tier={lit ? 1 : 0} size={56} alt={name} /> : null}
                  <span
                    className="block w-full truncate text-center"
                    style={{ fontSize: 10, color: lit ? INK_SOFT : MUTED, opacity: lit ? 1 : 0.55 }}
                  >
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Divider() {
  return <span style={{ width: 1, alignSelf: "center", height: 30, backgroundColor: TRACK }} />;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center" style={{ gap: 3 }}>
      <span className="font-extrabold tabular-nums" style={{ fontSize: 19, color: INK }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="m-0 font-bold" style={{ fontSize: 17, color: INK }}>
        {title}
      </h2>
      <span className="tabular-nums" style={{ fontSize: 12, color: MUTED }}>
        {sub}
      </span>
    </div>
  );
}

/** 单枚勋章：图 + 名 + 「离下一档还差多少」的细进度条（对齐 iOS `MedalCell`） */
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
  const from = tier > 0 ? def.tiers[tier - 1] : 0;
  const progress =
    next == null ? 1 : Math.min(1, Math.max(0, (current - from) / Math.max(1, next - from)));

  return (
    <div className="flex flex-col items-center" style={{ gap: 6 }}>
      <MedalIcon
        imageKey={def.key}
        tier={tier}
        tierCount={def.tiers.length}
        size={72}
        alt={medalText(def.name, locale)}
      />
      <span
        className="block w-full truncate text-center"
        style={{ fontSize: 12, color: tier > 0 ? INK : MUTED, fontWeight: tier > 0 ? 600 : 400 }}
      >
        {medalText(def.name, locale)}
      </span>
      {next != null ? (
        <div className="flex w-full flex-col items-center" style={{ gap: 3 }}>
          <span
            className="block w-full overflow-hidden rounded-full"
            style={{ height: 4, backgroundColor: TRACK }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `max(2px, ${progress * 100}%)`,
                backgroundColor: "rgba(255,177,1,0.85)",
                transition: "width 450ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </span>
          <span className="tabular-nums" style={{ fontSize: 10, color: MUTED }}>
            {current} / {next}
          </span>
        </div>
      ) : (
        <span className="block w-full truncate text-center" style={{ fontSize: 10, color: MUTED }}>
          {medalCondition(def.condition, def.tiers[def.tiers.length - 1], locale)}
        </span>
      )}
    </div>
  );
}
