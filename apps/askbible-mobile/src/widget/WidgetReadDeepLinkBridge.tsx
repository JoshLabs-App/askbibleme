import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";
import { parseWidgetReadDeepLink } from "./widget-read-chapter-url";

type Props = {
  enabled: boolean;
};

/** Warm-start widget taps: router.push with explicit tab route + verse param. */
export function WidgetReadDeepLinkBridge({ enabled }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const openReadChapter = (url: string | null | undefined) => {
      if (!url) return;
      const target = parseWidgetReadDeepLink(url);
      if (!target) return;
      router.push({
        pathname: "/(tabs)/read/[bookId]/[chapter]",
        params: {
          bookId: target.bookId,
          chapter: target.chapter,
          ...(target.verse ? { verse: target.verse } : {}),
        },
      });
    };

    const sub = Linking.addEventListener("url", ({ url }) => openReadChapter(url));
    return () => sub.remove();
  }, [enabled, router]);

  return null;
}
