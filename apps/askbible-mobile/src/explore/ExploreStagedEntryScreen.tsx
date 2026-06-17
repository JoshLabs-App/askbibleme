import { getExploreStagedRemoteModule, hasExploreStagedRemotePoolContent } from "./exploreHomeConfig";
import { ExploreStagedPlaceholderScreen } from "./ExploreStagedPlaceholderScreen";
import { ExploreStagedScripturePoolScreen } from "./ExploreStagedScripturePoolScreen";
import { isExploreScripturePoolEntryId, type ExploreStagedEntryId } from "./exploreStagedEntries";
import { useExploreModulesBundle } from "./useExploreModules";

type Props = {
  entryId: ExploreStagedEntryId;
};

/** 预埋探索入口：经文池有远程配置则显示汇编，否则空白占位 */
export function ExploreStagedEntryScreen({ entryId }: Props) {
  const bundle = useExploreModulesBundle();
  const remoteModule = getExploreStagedRemoteModule(bundle, entryId);

  if (isExploreScripturePoolEntryId(entryId) && remoteModule && hasExploreStagedRemotePoolContent(remoteModule)) {
    return <ExploreStagedScripturePoolScreen entryId={entryId} module={remoteModule} />;
  }

  return <ExploreStagedPlaceholderScreen entryId={entryId} />;
}
