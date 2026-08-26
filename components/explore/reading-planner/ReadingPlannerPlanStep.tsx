"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadingPlanStartDayPicker } from "@/components/explore/reading-planner/ReadingPlanStartDayPicker";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import { isFeaturedReadingPlanId } from "@/lib/bible/reading-plans/featured-reading-plans";
import { stripReadingPlanHtml } from "@/lib/bible/reading-plans/strip-html-description";
import {
  NT_DEEP_REPEAT_PACE_OPTIONS,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { exploreArticleHref } from "@/lib/explore/explore-featured-article-slugs";
import {
  readingPlannerChoiceMaxStartDay,
  readingPlannerChoiceSupportsStartDay,
  type ReadingPlannerPlanChoice,
} from "@/lib/explore/reading-planner/activate-reading-plan-from-planner";
import {
  getNtDeepPacePlannerCopy,
  getReadingPlannerStep3Intro,
  getTripleLoopPlannerCopy,
} from "@/lib/explore/reading-planner/reading-planner-plan-copy";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

type Props = {
  locale: AppLocale;
  choice: ReadingPlannerPlanChoice;
  onChange: (next: ReadingPlannerPlanChoice) => void;
  startDay: number;
  onStartDayChange: (next: number) => void;
  registryPlans: ReadingPlanRegistryEntry[];
};

function planFieldKey(planId: string, field: "title" | "subtitle" | "blurb"): string {
  return `pages.read.plansCatalog.${planId}.${field}`;
}

function trPlanField(
  t: (key: string) => string,
  planId: string,
  field: "title" | "subtitle" | "blurb",
): string {
  const key = planFieldKey(planId, field);
  const v = t(key);
  return v === key ? "" : v;
}

export function ReadingPlannerPlanStep({
  locale,
  choice,
  onChange,
  startDay,
  onStartDayChange,
  registryPlans,
}: Props) {
  const { t } = useLocale();
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const [otherExpanded, setOtherExpanded] = useState(choice.type === "other");

  const otherPlans = useMemo(
    () => registryPlans.filter((p) => !isFeaturedReadingPlanId(p.planId)),
    [registryPlans],
  );

  useEffect(() => {
    if (choice.type === "other") setOtherExpanded(true);
  }, [choice.type]);

  const supportsStartDay = readingPlannerChoiceSupportsStartDay(choice);
  const maxStartDay = readingPlannerChoiceMaxStartDay(choice);
  const tripleLoopCopy = useMemo(() => getTripleLoopPlannerCopy(locale), [locale]);
  const stepIntro = useMemo(() => getReadingPlannerStep3Intro(locale), [locale]);

  return (
    <div>
      <h1 className="reading-planner-title reading-planner-title--step2">{stepIntro.title}</h1>
      <p className="reading-planner-subtitle">{stepIntro.subtitle}</p>

      <section className="reading-planner-section">
        <p className="reading-planner-section-label">
          {locale === "en" ? "RECOMMENDED · EASY READING" : zhText("推荐 · 轻松读经")}
        </p>
        <button
          type="button"
          className={[
            "reading-planner-pace-card",
            choice.type === "triple-loop" ? "reading-planner-pace-card--selected" : "",
          ].join(" ")}
          onClick={() => onChange({ type: "triple-loop" })}
        >
          <div className="reading-planner-pace-card__header">
            <span className="reading-planner-pace-card__title">{tripleLoopCopy.title}</span>
            <span className="reading-planner-pace-card__badge">
              {locale === "en" ? "Start here" : zhText("建议起步")}
            </span>
          </div>
          <p className="reading-planner-pace-card__body">{tripleLoopCopy.body}</p>
          <ShellMaterialCommunityIcon
            name={choice.type === "triple-loop" ? "check-circle" : "checkbox-blank-circle-outline"}
            size={22}
            color={choice.type === "triple-loop" ? "#ffb101" : "rgba(138, 90, 11, 0.45)"}
            className="reading-planner-pace-card__check"
          />
        </button>
      </section>

      <section className="reading-planner-section reading-planner-section--muted">
        <p className="reading-planner-section-label reading-planner-section-label--muted">
          {locale === "en" ? "FORMAL STUDY" : zhText("正式研读")}
        </p>
        <div className="reading-planner-pace-list">
          {NT_DEEP_REPEAT_PACE_OPTIONS.map((pace) => {
            const selected = choice.type === "nt-deep-repeat" && choice.pace === pace;
            const copy = getNtDeepPacePlannerCopy(locale, pace);
            return (
              <button
                key={pace}
                type="button"
                className={[
                  "reading-planner-pace-card",
                  selected ? "reading-planner-pace-card--selected" : "",
                ].join(" ")}
                onClick={() => onChange({ type: "nt-deep-repeat", pace })}
              >
                <p className="reading-planner-pace-card__title">{copy.title}</p>
                <p className="reading-planner-pace-card__body">{copy.body}</p>
                {copy.reference ? (
                  <Link
                    href={exploreArticleHref(copy.reference.slug)}
                    className="reading-planner-pace-card__reference"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {locale === "en"
                      ? `Reference · ${copy.reference.label} →`
                      : zhText(`参考探索 · ${copy.reference.label} →`)}
                  </Link>
                ) : null}
                <ShellMaterialCommunityIcon
                  name={selected ? "check-circle" : "checkbox-blank-circle-outline"}
                  size={22}
                  color={selected ? "#ffb101" : "rgba(138, 90, 11, 0.45)"}
                  className="reading-planner-pace-card__check"
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="reading-planner-other">
        <button
          type="button"
          className="reading-planner-other__toggle"
          aria-expanded={otherExpanded}
          onClick={() => setOtherExpanded((v) => !v)}
        >
          <span>{locale === "en" ? "Other reading plans (optional)" : zhText("其它读经计划（可选）")}</span>
          <ShellMaterialCommunityIcon
            name={otherExpanded ? "chevron-up" : "chevron-down"}
            size={22}
            color="rgba(77, 53, 34, 0.62)"
          />
        </button>
        <p className="reading-planner-other__hint">
          {locale === "en"
            ? "Common calendar-style plans. AskBible recommends easy reading above."
            : zhText("以下为常见表格式计划，可按需选用；我们更推荐上面的轻松读经。")}
        </p>
        {otherExpanded ? (
          <ul className="reading-planner-other__list">
            {otherPlans.map((plan) => {
              const selected = choice.type === "other" && choice.planId === plan.planId;
              const title = trPlanField(t, plan.planId, "title") || plan.name;
              return (
                <li key={plan.planId}>
                  <button
                    type="button"
                    className={[
                      "reading-planner-other__row",
                      selected ? "reading-planner-other__row--selected" : "",
                    ].join(" ")}
                    onClick={() =>
                      onChange({ type: "other", planId: plan.planId, dayCount: plan.dayCount })
                    }
                  >
                    <div className="reading-planner-other__row-text">
                      <p className="reading-planner-other__row-title">{title}</p>
                      <p className="reading-planner-other__row-meta">
                        {t("pages.read.plansMeta", {
                          days: plan.dayCount,
                          max: plan.maxReadingsPerDay,
                        })}
                      </p>
                      {plan.description ? (
                        <p className="reading-planner-other__row-blurb">
                          {trPlanField(t, plan.planId, "blurb") || stripReadingPlanHtml(plan.description)}
                        </p>
                      ) : null}
                    </div>
                    <ShellMaterialCommunityIcon
                      name={selected ? "check-circle" : "checkbox-blank-circle-outline"}
                      size={20}
                      color={selected ? "#ffb101" : "rgba(138, 90, 11, 0.4)"}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {supportsStartDay ? (
        <ReadingPlanStartDayPicker
          locale={locale}
          value={startDay}
          max={maxStartDay}
          onChange={onStartDayChange}
        />
      ) : null}
    </div>
  );
}
