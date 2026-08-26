import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { UnifiedReadingWelcomeFlow } from "@/components/explore/reading-planner/UnifiedReadingWelcomeFlow";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("轻松读经"),
  description: "选择并开启适合你的读经节奏。",
};

/** 对齐 App `/explore/reading-planner`：轻松读经向导。 */
export default function ExploreReadingPlannerPage() {
  const registry = readReadingPlanRegistrySync(process.cwd());
  const plans = registry?.plans ?? [];

  return (
    <ExploreParchmentChrome>
      <UnifiedReadingWelcomeFlow entry="explore" registryPlans={plans} />
    </ExploreParchmentChrome>
  );
}
