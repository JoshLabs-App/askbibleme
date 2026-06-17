import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import type { MobileContentManifestAnnouncement } from "../api/mobileContentManifest";
import { fetchBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import type { AppLocale } from "../i18n/config";
import { resolveLocalizedField, resolveUiText } from "../i18n/site-copy";
import { readHomePrayerVersePrefs, writeHomePrayerVersePrefs } from "../home/homePrayerVersePrefs";
import {
  resolveDefaultPrimaryTranslationId,
  writeReadBibleTranslationPrefs,
  writeReadBibleTranslationPrefMode,
} from "../read/read-bible-translation-prefs";
import {
  dismissUpdateAnnouncementForever,
  snoozeUpdateAnnouncement,
} from "../updates/updateAnnouncementPrefs";

type UseShellNavDrawerMenuActionsParams = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  closeMenu: () => void;
  deleteAccount: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  t: (key: string) => string;
  resourceAnnouncement: MobileContentManifestAnnouncement | null;
  resourceAnnouncementActive: boolean;
  setResourceAnnouncementActive: (active: boolean) => void;
};

export function useShellNavDrawerMenuActions({
  locale,
  setLocale,
  closeMenu,
  deleteAccount,
  t,
  resourceAnnouncement,
  resourceAnnouncementActive,
  setResourceAnnouncementActive,
}: UseShellNavDrawerMenuActionsParams) {
  const [localeSwitching, setLocaleSwitching] = useState(false);

  const confirmDeleteAccount = useCallback(() => {
    closeMenu();
    Alert.alert(t("auth.deleteAccountTitle"), t("auth.deleteAccountMessage"), [
      { text: t("auth.deleteAccountCancel"), style: "cancel" },
      {
        text: t("auth.deleteAccountConfirm"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            const result = await deleteAccount();
            if (result.ok) return;
            const message =
              result.code === "admin_account"
                ? t("auth.deleteAccountAdminBlocked")
                : result.code === "network"
                  ? t("auth.errorNetwork")
                  : t("auth.deleteAccountFailedMessage");
            Alert.alert(t("auth.deleteAccountFailedTitle"), message);
          })();
        },
      },
    ]);
  }, [closeMenu, deleteAccount, t]);

  const showAnnouncementPrompt = useCallback(() => {
    const announcement = resourceAnnouncement;
    if (!announcement || !resourceAnnouncementActive) return;
    const title = resolveLocalizedField(announcement.title, locale).trim();
    if (!title) return;
    const body = resolveLocalizedField(announcement.body, locale).trim();
    const actionLabel = resolveLocalizedField(announcement.actionLabel, locale).trim();
    const snoozeHours = announcement.snoozeHours ?? (announcement.level === "critical" ? 12 : 24);
    const buttons: { text: string; style?: "cancel" | "default" | "destructive"; onPress?: () => void }[] = [
      {
        text: resolveUiText(locale, "稍后提醒", "Remind later"),
        style: "cancel",
        onPress: () => {
          void snoozeUpdateAnnouncement(announcement.announcementId, snoozeHours);
          setResourceAnnouncementActive(false);
        },
      },
    ];
    if (announcement.allowDismissForever !== false) {
      buttons.push({
        text: resolveUiText(locale, "不再提示", "Don't remind again"),
        style: "destructive",
        onPress: () => {
          void dismissUpdateAnnouncementForever(announcement.announcementId);
          setResourceAnnouncementActive(false);
        },
      });
    }
    if (announcement.actionUrl) {
      buttons.push({
        text: actionLabel || resolveUiText(locale, "查看详情", "View details"),
        onPress: () => {
          void Linking.openURL(announcement.actionUrl as string).catch(() => undefined);
          void snoozeUpdateAnnouncement(announcement.announcementId, 6);
          setResourceAnnouncementActive(false);
        },
      });
    }
    Alert.alert(
      title,
      body || resolveUiText(locale, "你可以稍后再处理此提醒。", "You can handle this reminder later."),
      buttons,
    );
  }, [locale, resourceAnnouncement, resourceAnnouncementActive, setResourceAnnouncementActive]);

  const handleLocaleChange = useCallback(
    (nextLocale: AppLocale) => {
      if (nextLocale === locale || localeSwitching) return;
      setLocale(nextLocale);
      setLocaleSwitching(true);
      void (async () => {
        try {
          const index = await fetchBibleTranslationsCatalog();
          const localePrimary = resolveDefaultPrimaryTranslationId(index, nextLocale);
          await writeReadBibleTranslationPrefs(
            {
              version: 1,
              primaryTranslationId: localePrimary,
              contrastTranslationIds: [],
              audioTranslationId: null,
            },
            index,
          );
          await writeReadBibleTranslationPrefMode("auto");

          const homePrefs = await readHomePrayerVersePrefs();
          await writeHomePrayerVersePrefs({
            ...homePrefs,
            primaryTranslationMode: "auto",
            verseTextZhTranslationId: localePrimary,
            verseTextEnTranslationId: "",
          });
        } finally {
          setLocaleSwitching(false);
        }
      })();
    },
    [locale, localeSwitching, setLocale],
  );

  return {
    localeSwitching,
    handleLocaleChange,
    confirmDeleteAccount,
    showAnnouncementPrompt,
  };
}
