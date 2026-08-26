import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { StyleProp, TextStyle } from "react-native";
import { musicAlbumIconIsCommunity, musicAlbumIconName } from "./musicAlbumCatalog";

type Props = {
  album: string;
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
};

export function MusicAlbumGlyph({ album, size, color, style }: Props) {
  const name = musicAlbumIconName(album);
  if (musicAlbumIconIsCommunity(album)) {
    return (
      <MaterialCommunityIcons
        name={name as keyof typeof MaterialCommunityIcons.glyphMap}
        size={size}
        color={color}
        style={style}
      />
    );
  }
  return (
    <MaterialIcons
      name={name as keyof typeof MaterialIcons.glyphMap}
      size={size}
      color={color}
      style={style}
    />
  );
}
