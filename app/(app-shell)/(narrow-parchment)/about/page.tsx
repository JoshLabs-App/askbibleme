import { AboutPage } from "@/components/about/AboutPage";
import { NarrowParchmentChrome } from "@/components/shell/NarrowParchmentChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("关于"),
  description:
    "AskBible.me 是一个让人重新进入圣经的安静入口——读得懂比读得多重要、能回来比完成计划重要，音乐灵修与经文陪伴，低认知负荷。",
};

export default function AboutRoutePage() {
  return (
    <NarrowParchmentChrome>
      <AboutPage />
    </NarrowParchmentChrome>
  );
}
