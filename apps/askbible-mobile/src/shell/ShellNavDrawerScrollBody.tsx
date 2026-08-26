import { useRouter } from "expo-router";
import { Linking, ScrollView, View } from "react-native";
import { resolveUiText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { ShellNavDrawerLocaleRow } from "./ShellNavDrawerLocaleRow";
import { ShellNavDrawerHomeTranslationSection } from "./ShellNavDrawerHomeTranslationSection";
import { ShellNavDrawerMenuRow } from "./ShellNavDrawerMenuRow";
import { ShellNavDrawerReadingSyncSection } from "./ShellNavDrawerReadingSyncSection";
import { SUPPORT_EMAIL } from "./shellNavDrawerConstants";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";
type Props = {
  locale: AppLocale;
  closeMenu: () => void;
  memberAuthEnabled: boolean;
  user: { name?: string | null; email?: string | null } | null;
  signOut: () => void;
  confirmDeleteAccount: () => void;
  handleLocaleChange: (next: AppLocale) => void;
  localeSwitching: boolean;
  open: boolean;
  onOpenBibleVersionPicker: () => void;
};

export function ShellNavDrawerScrollBody({
  locale,
  closeMenu,
  memberAuthEnabled,
  user,
  signOut,
  confirmDeleteAccount,
  handleLocaleChange,
  localeSwitching,
  open,
  onOpenBibleVersionPicker,
}: Props) {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <ShellNavDrawerLocaleRow locale={locale} onLocaleChange={handleLocaleChange} switching={localeSwitching} />
      <View style={styles.compactGap} />
      {open ? (
        <ShellNavDrawerHomeTranslationSection
          locale={locale}
          onOpenBibleVersionPicker={onOpenBibleVersionPicker}
        />
      ) : null}
      {open ? <View style={styles.compactGap} /> : null}
      {memberAuthEnabled ? (
        <>
          {user ? (
            <>
              <ShellNavDrawerMenuRow
                label={resolveUiText(locale, "已登录", "Signed in")}
                detail={user.name ?? user.email ?? undefined}
                onPress={() => closeMenu()}
              />
              <View style={styles.compactGap} />
              <ShellNavDrawerMenuRow
                label={resolveUiText(locale, "退出登录", "Log out")}
                onPress={() => {
                  closeMenu();
                  void signOut();
                }}
              />
              <View style={styles.compactGap} />
            </>
          ) : (
            <>
              <ShellNavDrawerMenuRow
                label={resolveUiText(locale, "登录", "Log in")}
                onPress={() => {
                  closeMenu();
                  router.push("/login");
                }}
              />
              <View style={styles.compactGap} />
              <ShellNavDrawerMenuRow
                label={resolveUiText(locale, "注册", "Register")}
                onPress={() => {
                  closeMenu();
                  router.push("/register");
                }}
              />
              <View style={styles.compactGap} />
            </>
          )}
        </>
      ) : null}
      <ShellNavDrawerMenuRow
        label={resolveUiText(locale, "发送反馈", "Send feedback")}
        detail={SUPPORT_EMAIL}
        onPress={async () => {
          closeMenu();
          const mailto = `mailto:${SUPPORT_EMAIL}`;
          const canOpen = await Linking.canOpenURL(mailto);
          if (canOpen) {
            await Linking.openURL(mailto);
            return;
          }
          router.push("/feedback");
        }}
      />
      {user ? <ShellNavDrawerReadingSyncSection locale={locale} /> : null}
      {memberAuthEnabled && user ? (
        <ShellNavDrawerMenuRow
          label={resolveUiText(locale, "删除账户", "Delete account")}
          quiet
          onPress={confirmDeleteAccount}
        />
      ) : null}
    </ScrollView>
  );
}
