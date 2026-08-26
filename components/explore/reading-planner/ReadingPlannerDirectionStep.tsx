"use client";

import Link from "next/link";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { exploreArticleHref } from "@/lib/explore/explore-featured-article-slugs";
import { READING_PLANNER_EXPLORE_ARTICLE_SLUG } from "@/lib/explore/reading-planner-routes";
import type { ReadingPlannerDirectionCard } from "@/lib/explore/reading-planner/reading-planner-data";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

type Props = {
  locale: AppLocale;
  cards: ReadingPlannerDirectionCard[];
};

function mapIcon(name: string): string {
  switch (name) {
    case "magnify":
      return "magnify";
    case "book-open-page-variant-outline":
      return "book-open-page-variant-outline";
    case "candle":
      return "candle";
    case "heart-outline":
      return "heart-outline";
    default:
      return "circle-outline";
  }
}

export function ReadingPlannerDirectionStep({ locale, cards }: Props) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);

  return (
    <div>
      <h1 className="reading-planner-title">
        {locale === "en" ? "Easy reading, your way" : zhText("轻松读经，按你的节奏")}
      </h1>
      <p className="reading-planner-subtitle">
        {locale === "en"
          ? "No streaks or guilt—pick light daily reading or formal study when you are ready."
          : zhText("不靠打卡、不靠压力；想毫无负担地读，或想正式研读读懂圣经，都可以。")}
      </p>

      <ul className="reading-planner-card-list">
        {cards.map((card) => (
          <li key={card.id} className="reading-planner-card">
            <span className="reading-planner-card__icon" aria-hidden>
              <ShellMaterialCommunityIcon name={mapIcon(card.icon)} size={22} color="#ffb101" />
            </span>
            <div>
              <p className="reading-planner-card__title">{card.title}</p>
              <p className="reading-planner-card__desc">{card.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <Link href={exploreArticleHref(READING_PLANNER_EXPLORE_ARTICLE_SLUG)} className="reading-planner-learn-more">
        {locale === "en" ? "Learn more about easy reading →" : zhText("了解更多轻松读经 →")}
      </Link>
    </div>
  );
}
