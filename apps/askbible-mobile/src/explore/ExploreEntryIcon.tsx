import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ExploreEntry } from "./exploreEntries";

type Props = {
  entry: ExploreEntry;
  size: number;
  color: string;
};

export function ExploreEntryIcon({ entry, size, color }: Props) {
  if (entry.iconSet === "material-community") {
    return <MaterialCommunityIcons name={entry.icon} size={size} color={color} />;
  }
  return <MaterialIcons name={entry.icon} size={size} color={color} />;
}
