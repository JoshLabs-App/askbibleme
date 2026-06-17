import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useSyncExternalStore } from "react";
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
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
  subscribeHomeVersePoolScope,
} from "../home/homeVersePoolScopePrefs";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { ShellNavDrawerScrollBody } from "./ShellNavDrawerScrollBody";
import {
  shellNavDrawerParchmentSource,
  shellNavDrawerWidth,
} from "./shellNavDrawerConstants";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";
import { useShellNavDrawerAnimation } from "./useShellNavDrawerAnimation";
import { useShellNavDrawerMenuActions } from "./useShellNavDrawerMenuActions";
import { useShellNavDrawerResourceUpdates } from "./useShellNavDrawerResourceUpdates";
import { useShellNavDrawerTtsState } from "./useShellNavDrawerTtsState";
import { getMobileAppVersionLabel } from "./mobileAppVersion";
import { useShellNavMenu } from "./ShellNavMenuContext";
import { useShellSwipeSuspend } from "./useShellSwipeSuspend";

/** 左上用户菜单：自左侧全高滑出（对齐网站 / X 式抽屉，非 Tab 导航） */
export function ShellNavDrawer() {
  const insets = useSafeAreaInsets();
  const { locale, setLocale, t } = useLocale();
  const { open, closeMenu } = useShellNavMenu();
  useShellSwipeSuspend(open);
  const memberAuthEnabled = useSyncExternalStore(
    subscribeMemberRegisterEnabled,
    getMemberRegisterEnabled,
    getMemberRegisterEnabled,
  );
  const { user, signOut, deleteAccount } = useMemberAuth();

  const panelW = shellNavDrawerWidth();
  const { slideX, backdropOpacity, visible } = useShellNavDrawerAnimation(open, panelW);
  const { checkMusicCatalogUpdate, downloadMusicCatalogUpdate } = useMusicPlayback();
  const resource = useShellNavDrawerResourceUpdates(open, locale, checkMusicCatalogUpdate);
  const homeTtsExperimentEnabled = useSyncExternalStore(
    subscribeHomeTtsExperiment,
    getHomeTtsExperimentEnabled,
    getHomeTtsExperimentEnabled,
  );
  const homeVersePoolScope = useSyncExternalStore(
    subscribeHomeVersePoolScope,
    getHomeVersePoolScope,
    getHomeVersePoolScope,
  );
  const tts = useShellNavDrawerTtsState(open, homeTtsExperimentEnabled, locale);
  const { localeSwitching, handleLocaleChange, confirmDeleteAccount, showAnnouncementPrompt } =
    useShellNavDrawerMenuActions({
      locale,
      setLocale,
      closeMenu,
      deleteAccount,
      t,
      resourceAnnouncement: resource.resourceAnnouncement,
      resourceAnnouncementActive: resource.resourceAnnouncementActive,
      setResourceAnnouncementActive: resource.setResourceAnnouncementActive,
    });

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void hydrateHomeTtsExperiment();
      void hydrateHomeVersePoolScope();
    });
    return () => task.cancel();
  }, []);

  return (
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
                <Text style={styles.title}>{t("nav.drawerUserMenuTitle")}</Text>
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
                t={t}
                closeMenu={closeMenu}
                memberAuthEnabled={memberAuthEnabled}
                user={user}
                signOut={signOut}
                confirmDeleteAccount={confirmDeleteAccount}
                homeVersePoolScope={homeVersePoolScope}
                homeTtsExperimentEnabled={homeTtsExperimentEnabled}
                tts={tts}
                resource={resource}
                downloadMusicCatalogUpdate={downloadMusicCatalogUpdate}
                handleLocaleChange={handleLocaleChange}
                localeSwitching={localeSwitching}
                showAnnouncementPrompt={showAnnouncementPrompt}
              />
              <Text style={styles.versionFooter} accessibilityRole="text">
                {getMobileAppVersionLabel()}
              </Text>
            </View>
          </ImageBackground>
        </Animated.View>
      </View>
    </Modal>
  );
}
