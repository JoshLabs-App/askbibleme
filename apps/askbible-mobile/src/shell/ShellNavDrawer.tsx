import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Animated,
  ImageBackground,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveUiText } from "../i18n/site-copy";
import {
  getMemberRegisterEnabled,
  subscribeMemberRegisterEnabled,
} from "../auth/member-register-enabled";
import { useMemberAuth } from "../auth/MemberAuthProvider";
import { useLocale } from "../i18n/LocaleProvider";
import {
  getHomeTtsExperimentEnabled,
  hydrateHomeTtsExperiment,
  subscribeHomeTtsExperiment,
} from "../home/homeExperimentalFeatures";
import { ShellNavDrawerBibleVersionPicker } from "./ShellNavDrawerHomeTranslationSection";
import { ShellNavDrawerScrollBody } from "./ShellNavDrawerScrollBody";
import {
  shellNavDrawerParchmentSource,
  shellNavDrawerWidth,
} from "./shellNavDrawerConstants";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";
import { useShellNavDrawerAnimation } from "./useShellNavDrawerAnimation";
import { useShellNavDrawerMenuActions } from "./useShellNavDrawerMenuActions";
import { getMobileAppVersionLabel } from "./mobileAppVersion";
import { useShellNavMenu } from "./ShellNavMenuContext";
import { useShellSwipeSuspend } from "./useShellSwipeSuspend";

/** 左上用户菜单：自左侧全高滑出（对齐网站 / X 式抽屉，非 Tab 导航） */
export function ShellNavDrawer() {
  const insets = useSafeAreaInsets();
  const { locale, setLocale, t } = useLocale();
  const { open, closeMenu } = useShellNavMenu();
  const [biblePickerOpen, setBiblePickerOpen] = useState(false);
  useShellSwipeSuspend(open || biblePickerOpen);

  const openBibleVersionPicker = useCallback(() => {
    setBiblePickerOpen(true);
    closeMenu();
  }, [closeMenu]);
  const memberAuthEnabled = useSyncExternalStore(
    subscribeMemberRegisterEnabled,
    getMemberRegisterEnabled,
    getMemberRegisterEnabled,
  );
  const { user, signOut, deleteAccount } = useMemberAuth();

  const handleSignOut = useCallback(() => {
    closeMenu();
    void signOut();
  }, [closeMenu, signOut]);

  const panelW = shellNavDrawerWidth();
  const { slideX, backdropOpacity, visible } = useShellNavDrawerAnimation(open, panelW);
  const homeTtsExperimentEnabled = useSyncExternalStore(
    subscribeHomeTtsExperiment,
    getHomeTtsExperimentEnabled,
    getHomeTtsExperimentEnabled,
  );
  const { localeSwitching, handleLocaleChange, confirmDeleteAccount } =
    useShellNavDrawerMenuActions({
      locale,
      setLocale,
      closeMenu,
      deleteAccount,
      t,
    });

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void hydrateHomeTtsExperiment();
    });
    return () => task.cancel();
  }, []);

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={styles.root}>
          <Animated.View pointerEvents={open ? "auto" : "none"} style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} accessibilityLabel={t("chrome.closeNavMenu")} />
          </Animated.View>

          <Animated.View
            style={[
              styles.drawer,
              {
                width: panelW,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <ImageBackground
              source={shellNavDrawerParchmentSource}
              resizeMode="cover"
              style={styles.drawerBg}
              imageStyle={styles.drawerBgImage}
            >
              <View
                style={[
                  styles.drawerContent,
                  {
                    paddingTop: Math.max(insets.top, 12),
                    paddingBottom: Math.max(insets.bottom, 16),
                    paddingLeft: Math.max(insets.left, 14),
                    paddingRight: Math.max(insets.right, 14),
                  },
                ]}
              >
                <View style={styles.header}>
                  <Text style={styles.title}>{resolveUiText(locale, "用户菜单", "User menu")}</Text>
                  <Pressable
                    onPress={closeMenu}
                    hitSlop={8}
                    style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t("chrome.closeNavMenu")}
                  >
                    <MaterialIcons name="close" size={22} color="rgba(55, 53, 47, 0.82)" />
                  </Pressable>
                </View>

                <ShellNavDrawerScrollBody
                  locale={locale}
                  closeMenu={closeMenu}
                  memberAuthEnabled={memberAuthEnabled}
                  user={user}
                  signOut={handleSignOut}
                  confirmDeleteAccount={confirmDeleteAccount}
                  handleLocaleChange={handleLocaleChange}
                  localeSwitching={localeSwitching}
                  open={open}
                  onOpenBibleVersionPicker={openBibleVersionPicker}
                />
                <Text style={styles.versionFooter} accessibilityRole="text">
                  {getMobileAppVersionLabel()}
                </Text>
              </View>
            </ImageBackground>
          </Animated.View>
        </View>
      </Modal>
      <ShellNavDrawerBibleVersionPicker
        locale={locale}
        visible={biblePickerOpen}
        onClose={() => setBiblePickerOpen(false)}
      />
    </>
  );
}
