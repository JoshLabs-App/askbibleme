"use client";

import dynamic from "next/dynamic";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

const ReadChapterInfoEditionMarkdown = dynamic(
  () =>
    import("@/components/bible/ReadChapterInfoEditionMarkdown").then(
      (mod) => mod.ReadChapterInfoEditionMarkdown,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="read-chapter-info-edition-panel-skeleton" aria-hidden />
    ),
  },
);

type Props = {
  published: InfoEditionV1PublishedChapter;
};

/** 读经页经文下方：基础版导读（与经文分区展示；Markdown 仅客户端渲染） */
export function ReadChapterInfoEditionBlock({ published }: Props) {
  const { t } = useLocale();

  return (
    <section
      className="read-chapter-info-edition"
      aria-label={t("pages.read.infoEditionAriaLabel")}
    >
      <div className="read-chapter-info-edition-divider" role="separator" aria-hidden>
        <span className="read-chapter-info-edition-divider-line" />
        <span className="read-chapter-info-edition-divider-label">
          <span className="read-chapter-info-edition-kicker">{t("pages.read.infoEditionSectionKicker")}</span>
          <span className="read-chapter-info-edition-role">{published.roleLabel}</span>
        </span>
        <span className="read-chapter-info-edition-divider-line" />
      </div>

      <p className="read-chapter-info-edition-disclaimer">{t("pages.read.infoEditionDisclaimer")}</p>

      <div className="read-chapter-info-edition-panel">
        <ReadChapterInfoEditionMarkdown content={published.markdown} />
      </div>
    </section>
  );
}
