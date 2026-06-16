import { refreshExploreFeaturedArticlesInBackground } from "./fetchExploreFeaturedArticles";
import { refreshExploreModulesInBackground } from "./fetchExploreModules";
import { hydrateExploreFeaturedArticlesFromDisk } from "./fetchExploreFeaturedArticles";
import { hydrateExploreModulesFromDisk } from "./fetchExploreModules";
import { refreshMobileLegacyFiguresInBackground } from "../legacy-figures/fetchMobileLegacyFigures";
import { hydrateMobileLegacyFiguresFromDisk } from "../legacy-figures/fetchMobileLegacyFigures";
import { InteractionManager } from "react-native";

let hydratedOnce = false;

/** 探索 Tab 聚焦时：先恢复本地缓存，再后台静默检查文章 / 人物库 / 模块内容更新。 */
export function refreshExploreContentWhenFocused(): void {
  if (!hydratedOnce) {
    hydratedOnce = true;
    void hydrateExploreFeaturedArticlesFromDisk();
    void hydrateMobileLegacyFiguresFromDisk();
    void hydrateExploreModulesFromDisk();
  }

  InteractionManager.runAfterInteractions(() => {
    refreshExploreFeaturedArticlesInBackground();
    refreshMobileLegacyFiguresInBackground();
    refreshExploreModulesInBackground();
  });
}
