import { cookies, headers } from "next/headers";
import { ExploreYearDayCountContent } from "@/components/explore/ExploreYearDayCountContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { loadYearsDaysEternityEnScriptureOverrides } from "@/lib/explore/load-years-days-eternity-en-scriptures";
import { loadAllYearDayCountScriptureTexts } from "@/lib/explore/year-day-count-scriptures";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("数算年日"),
  description: "以生日为起点，在百年横轴上看自己已走过的日子。",
};

export default async function ExploreYearDayCountPage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const [initialScriptureTexts, { enScriptureBodyByRef, enRefLabelByRaw }] = await Promise.all([
    loadAllYearDayCountScriptureTexts(locale),
    loadYearsDaysEternityEnScriptureOverrides(locale),
  ]);

  return (
    <ExploreParchmentChrome>
      <ExploreYearDayCountContent
        initialScriptureTexts={initialScriptureTexts}
        enScriptureBodyByRef={enScriptureBodyByRef}
        enRefLabelByRaw={enRefLabelByRaw}
      />
    </ExploreParchmentChrome>
  );
}
