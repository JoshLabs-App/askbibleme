import { StyleSheet } from "react-native";
import { musicAlbumVisualCoreStyleDefs } from "./musicAlbumVisualCoreStyles";
import { musicAlbumVisualSceneStyleDefs } from "./musicAlbumVisualSceneStyles";

export const musicAlbumVisualStyles = StyleSheet.create({
  ...musicAlbumVisualCoreStyleDefs,
  ...musicAlbumVisualSceneStyleDefs,
});

/** @deprecated use musicAlbumVisualStyles — kept for existing imports */
export const visualStyles = musicAlbumVisualStyles;
