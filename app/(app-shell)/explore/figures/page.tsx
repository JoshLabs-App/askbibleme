import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { ExploreFiguresPageClient } from "@/components/explore/ExploreFiguresPageClient";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { readLegacyFiguresTimelineBookRows } from "@/lib/read-legacy-figures-timeline";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

/**
 * 元数据用默认语言：读 cookie/Accept-Language 会让本页只能动态渲染，而页面正文的语言
 * 由 ExploreFiguresPageClient 在客户端自取。标题只影响分享卡片与标签页，网页版按默认
 * 语言给一份即可。
 */
export const metadata = {
  title: sitePageTitle(getMessages(DEFAULT_LOCALE).pages.explore.figuresTitle),
  description: getMessages(DEFAULT_LOCALE).pages.explore.figuresSubtitle,
};

export default function ExploreFiguresPage() {
  const bookRows = readLegacyFiguresTimelineBookRows();

  return (
    <ExploreParchmentChrome>
      <ExploreFiguresPageClient initialBookRows={bookRows} />
    </ExploreParchmentChrome>
  );
}
