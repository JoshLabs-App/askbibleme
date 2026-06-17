import { cookies, headers } from "next/headers";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { LegacyFiguresTimeline } from "@/components/legacy/LegacyFiguresTimeline";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { getMessages } from "@/lib/i18n/messages";
import { readLegacyFiguresTimelineBookRows } from "@/lib/read-legacy-figures-timeline";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const title = getMessages(locale).pages.explore.figuresTitle;
  return {
    title: sitePageTitle(title),
    description: getMessages(locale).pages.explore.figuresSubtitle,
  };
}

export default async function ExploreFiguresPage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const bookRows = readLegacyFiguresTimelineBookRows();

  return (
    <ExploreParchmentChrome>
      <LegacyFiguresTimeline bookRows={bookRows} locale={locale} />
    </ExploreParchmentChrome>
  );
}
