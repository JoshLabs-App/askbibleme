import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { toZhTwText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { ShellSwipeExclude, useShellSwipeExcludeHandlers } from "../shell/ShellSwipeExclude";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import { EdgeFadeHorizontalScrollView } from "../ui/EdgeFadeHorizontalScrollView";
import { MusicAlbumGlyph } from "./MusicAlbumGlyph";
import {
  musicAlbumShortLabel,
  musicAlbumShortLabelEn,
} from "./musicAlbumCatalog";
import {
  ALBUM_BTN_GAP,
  ALBUM_BTN_WIDTH,
  ALBUM_STRIP_FADE,
  albumStripContentWidth,
  albumStripScrollX,
} from "./musicAlbumStripLayout";

type Props = {
  locale: AppLocale;
  album: string;
  albumNames: string[];
  albumCounts: Record<string, number>;
  onSelectAlbum: (album: string) => void;
};

export function MusicHomeAlbumPicker({
  locale,
  album,
  albumNames,
  albumCounts,
  onSelectAlbum,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const didCenter = useRef(false);
  const swipeExclude = useShellSwipeExcludeHandlers();
  const [viewportWidth, setViewportWidth] = useState(0);
  const contentWidth = albumStripContentWidth(albumNames.length);
  const overflows = viewportWidth > 0 && contentWidth > viewportWidth;

  useEffect(() => {
    if (viewportWidth < 1) return;
    const index = albumNames.indexOf(album);
    const x = overflows ? albumStripScrollX(index, viewportWidth, albumNames.length) : 0;
    scrollRef.current?.scrollTo({ x, animated: didCenter.current });
    didCenter.current = true;
  }, [album, albumNames, overflows, viewportWidth]);

  return (
    <ShellSwipeExclude style={styles.albumStrip}>
      <EdgeFadeHorizontalScrollView
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        alwaysBounceHorizontal={overflows}
        directionalLockEnabled
        nestedScrollEnabled
        fadeLeftPx={0}
        fadeRightPx={overflows ? ALBUM_STRIP_FADE : 0}
        fallbackScrimColor="rgba(0,0,0,0.45)"
        onTouchStart={swipeExclude.onTouchStart}
        onScrollBeginDrag={swipeExclude.onScrollBeginDrag}
        contentContainerStyle={[
          styles.albumRow,
          {
            minWidth: Math.max(contentWidth, viewportWidth),
            justifyContent: overflows ? "flex-start" : "center",
          },
        ]}
        style={styles.albumScroll}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== viewportWidth) setViewportWidth(w);
        }}
      >
        {albumNames.map((albumName) => {
          const selected = albumName === album;
          const count = albumCounts[albumName] ?? 0;
          const empty = count <= 0;
          const labelZh = musicAlbumShortLabel(albumName);
          const label =
            locale === "en"
              ? musicAlbumShortLabelEn(albumName)
              : locale === "zh-TW"
                ? toZhTwText(labelZh)
                : labelZh;
          const color = selected
            ? LOGO_COLOR
            : empty
              ? "rgba(255,255,255,0.34)"
              : "rgba(255,255,255,0.78)";
          return (
            <Pressable
              key={albumName}
              onPress={() => onSelectAlbum(albumName)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.albumBtn,
                empty && styles.albumBtnEmpty,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}（${count}）`}
            >
              <MusicAlbumGlyph album={albumName} size={36} color={color} />
              <Text
                style={[styles.albumLabel, selected && styles.albumLabelSelected]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </EdgeFadeHorizontalScrollView>
    </ShellSwipeExclude>
  );
}

const styles = StyleSheet.create({
  albumStrip: {
    width: "100%",
    marginTop: -4,
    marginBottom: 10,
    zIndex: 6,
  },
  albumScroll: {
    width: "100%",
  },
  albumRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ALBUM_BTN_GAP,
  },
  albumBtn: {
    width: ALBUM_BTN_WIDTH,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "transparent",
    paddingVertical: 4,
  },
  albumBtnEmpty: {
    opacity: 0.72,
  },
  albumLabel: {
    marginTop: 6,
    width: ALBUM_BTN_WIDTH,
    fontSize: 12,
    lineHeight: 16,
    ...parchmentSans(500),
    color: "#FFFFFF",
    textAlign: "center",
  },
  albumLabelSelected: {
    color: LOGO_COLOR,
  },
  pressed: { opacity: 0.65 },
});
