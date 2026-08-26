import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { applyLocaleWithTranslationPrefs } from "../i18n/applyLocaleWithTranslationPrefs";
import type { AppLocale } from "../i18n/config";

type UseShellNavDrawerMenuActionsParams = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  closeMenu: () => void;
  deleteAccount: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  t: (key: string) => string;
};

export function useShellNavDrawerMenuActions({
  locale,
  setLocale,
  closeMenu,
  deleteAccount,
  t,
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

  const handleLocaleChange = useCallback(
    (nextLocale: AppLocale) => {
      if (nextLocale === locale || localeSwitching) return;
      setLocale(nextLocale);
      setLocaleSwitching(true);
      void (async () => {
        try {
          await applyLocaleWithTranslationPrefs(nextLocale);
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
  };
}
