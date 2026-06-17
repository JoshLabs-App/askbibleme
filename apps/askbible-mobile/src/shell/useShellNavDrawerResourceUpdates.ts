import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  checkMobileResourceUpdates,
  readMobileResourceUpdateState,
  subscribeMobileResourceUpdate,
  type MobileResourceUpdateItem,
} from "../updates/mobileResourceUpdate";
import {
  fetchMobileContentManifest,
  type MobileContentManifestAnnouncement,
} from "../api/mobileContentManifest";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import { shouldShowUpdateAnnouncement } from "../updates/updateAnnouncementPrefs";

export function useShellNavDrawerResourceUpdates(
  open: boolean,
  locale: AppLocale,
  checkMusicCatalogUpdate: () => Promise<boolean>,
) {
  const [resourceUpdateChecking, setResourceUpdateChecking] = useState(false);
  const [resourceUpdateAvailable, setResourceUpdateAvailable] = useState(false);
  const [resourceUpdateItems, setResourceUpdateItems] = useState<MobileResourceUpdateItem[]>([]);
  const [resourceUpdateSheetOpen, setResourceUpdateSheetOpen] = useState(false);
  const [resourceUpdateProgress, setResourceUpdateProgress] = useState(() => readMobileResourceUpdateState());
  const [resourceAnnouncement, setResourceAnnouncement] = useState<MobileContentManifestAnnouncement | null>(null);
  const [resourceAnnouncementActive, setResourceAnnouncementActive] = useState(false);

  useEffect(() => {
    return subscribeMobileResourceUpdate(() => {
      setResourceUpdateProgress(readMobileResourceUpdateState());
    });
  }, []);

  const checkResourceUpdates = async () => {
    if (resourceUpdateChecking || resourceUpdateProgress.phase === "downloading") return false;
    if (isMobileBundledOnly()) {
      setResourceUpdateAvailable(false);
      setResourceUpdateItems([]);
      return false;
    }
    setResourceUpdateChecking(true);
    try {
      const items = await checkMobileResourceUpdates({ isMusicUpdateAvailable: checkMusicCatalogUpdate });
      const available = items.length > 0;
      setResourceUpdateAvailable(available);
      setResourceUpdateItems(items);
      return available;
    } finally {
      setResourceUpdateChecking(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void checkResourceUpdates();
    });
    return () => task.cancel();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const manifest = await fetchMobileContentManifest();
          if (!alive) return;
          const announcement = manifest.announcement ?? null;
          if (!announcement) {
            setResourceAnnouncement(null);
            setResourceAnnouncementActive(false);
            return;
          }
          const active = await shouldShowUpdateAnnouncement(announcement.announcementId);
          if (!alive) return;
          setResourceAnnouncement(announcement);
          setResourceAnnouncementActive(active);
        } catch {
          if (!alive) return;
          setResourceAnnouncement(null);
          setResourceAnnouncementActive(false);
        }
      })();
    });
    return () => {
      alive = false;
      task.cancel();
    };
  }, [open]);

  const resourceUpdateApplying = resourceUpdateProgress.phase === "downloading";
  const resourceNeedsAttention = resourceUpdateAvailable || resourceAnnouncementActive;
  const resourceUpdateDetail = resourceUpdateApplying
    ? resolveUiText(locale, `下载中 ${resourceUpdateProgress.overallPercent}%`, `Downloading ${resourceUpdateProgress.overallPercent}%`)
    : resourceUpdateChecking
      ? resolveUiText(locale, "检查中…", "Checking...")
      : resourceUpdateAvailable && resourceAnnouncementActive
        ? resolveUiText(locale, "发现新资源与通知", "New resources and notice")
        : resourceUpdateAvailable
          ? resolveUiText(locale, `${resourceUpdateItems.length} 项可更新`, `${resourceUpdateItems.length} updates`)
          : resourceAnnouncementActive
            ? resolveUiText(locale, "有新通知", "New notice")
            : resolveUiText(locale, "已是最新", "Up to date");

  return {
    resourceUpdateChecking,
    resourceUpdateAvailable,
    resourceUpdateItems,
    resourceUpdateSheetOpen,
    setResourceUpdateSheetOpen,
    resourceUpdateProgress,
    resourceAnnouncement,
    resourceAnnouncementActive,
    setResourceAnnouncementActive,
    resourceUpdateApplying,
    resourceNeedsAttention,
    resourceUpdateDetail,
    checkResourceUpdates,
  };
}
