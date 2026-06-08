import { cookies, headers } from "next/headers";
import { ExploreHomeContent } from "@/components/explore/ExploreHomeContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { readExploreFeaturedArticles } from "@/lib/explore/explore-featured-articles";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("探索"),
  description: "更多小惊喜正在路上；也可从这儿打开祷告与经文。",
};

export default async function ExplorePage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const featuredArticles = readExploreFeaturedArticles(locale);

  return (
    <ExploreParchmentChrome>
      <ExploreHomeContent featuredArticles={featuredArticles} />
    </ExploreParchmentChrome>
  );
}
