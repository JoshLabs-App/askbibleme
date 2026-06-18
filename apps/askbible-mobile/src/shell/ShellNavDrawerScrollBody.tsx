import { useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { resolveUiText } from "../i18n/site-copy";
import { requestOpenOnboardingDevotionIntro } from "../onboarding/onboarding-devotion-gate";
import { resetOnboardingDevotionIntro } from "../onboarding/onboarding-devotion-prefs";
import { ResourceUpdateSheet } from "../updates/ResourceUpdateSheet";
import type { AppLocale } from "../i18n/config";
import type { HomeVersePoolScopeId } from "../explore/explore-home-verse-pool-scopes";
import { ShellNavDrawerHomeVersePoolSection } from "./ShellNavDrawerHomeVersePoolSection";
import { ShellNavDrawerLocaleRow } from "./ShellNavDrawerLocaleRow";
import { ShellNavDrawerMenuRow } from "./ShellNavDrawerMenuRow";
import { ShellNavDrawerReadingSyncSection } from "./ShellNavDrawerReadingSyncSection";
import { ShellNavDrawerTtsExperimentSection } from "./ShellNavDrawerTtsExperimentSection";
import { SUPPORT_EMAIL } from "./shellNavDrawerConstants";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";
import type { useShellNavDrawerResourceUpdates } from "./useShellNavDrawerResourceUpdates";
import type { useShellNavDrawerTtsState } from "./useShellNavDrawerTtsState";

type ResourceUpdates = ReturnType<typeof useShellNavDrawerResourceUpdates>;
type TtsState = ReturnType<typeof useShellNavDrawerTtsState>;

type Props = {
  locale: AppLocale;
  t: (key: string) => string;
  closeMenu: () => void;
  memberAuthEnabled: boolean;
  user: { name?: string | null; email?: string | null } | null;
  signOut: () => Promise<void>;
  confirmDeleteAccount: () => void;
  homeVersePoolScope: HomeVersePoolScopeId;
  homeTtsExperimentEnabled: boolean;
  tts: TtsState;
  resource: ResourceUpdates;
  downloadMusicCatalogUpdate: () => Promise<boolean>;
  handleLocaleChange: (next: AppLocale) => void;
  localeSwitching: boolean;
  showAnnouncementPrompt: () => void;
};

export function ShellNavDrawerScrollBody({
  locale,
  t,
  closeMenu,
  memberAuthEnabled,
  user,
  signOut,
  confirmDeleteAccount,
  homeVersePoolScope,
  homeTtsExperimentEnabled,
  tts,
  resource,
  downloadMusicCatalogUpdate,
  handleLocaleChange,
  localeSwitching,
  showAnnouncementPrompt,
}: Props) {
  const router = useRouter();
  const {
    resourceUpdateChecking,
    resourceUpdateAvailable,
    resourceUpdateItems,
    resourceUpdateSheetOpen,
    setResourceUpdateSheetOpen,
    resourceUpdateProgress,
    resourceAnnouncement,
    resourceAnnouncementActive,
    resourceUpdateApplying,
    resourceNeedsAttention,
    resourceUpdateDetail,
    checkResourceUpdates,
  } = resource;

  return (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <ShellNavDrawerLocaleRow locale={locale} onLocaleChange={handleLocaleChange} switching={localeSwitching} />
      <View style={styles.compactGap} />
      <ShellNavDrawerHomeVersePoolSection locale={locale} homeVersePoolScope={homeVersePoolScope} />
      <View style={styles.compactGap} />
      <ShellNavDrawerTtsExperimentSection
        locale={locale}
        homeTtsExperimentEnabled={homeTtsExperimentEnabled}
        rateLabel={tts.rateLabel}
        pitchLabel={tts.pitchLabel}
        rateLabels={tts.rateLabels}
        pitchLabels={tts.pitchLabels}
        ttsRateLevel={tts.ttsRateLevel}
        ttsPitchLevel={tts.ttsPitchLevel}
        ttsVoiceId={tts.ttsVoiceId}
        voiceOptions={tts.voiceOptions}
        persistTtsPrefs={tts.persistTtsPrefs}
      />
      <View style={styles.compactGap} />
      <ShellNavDrawerMenuRow
        label={resolveUiText(locale, "资源更新", "Resource updates")}
        detail={resourceUpdateDetail}
        selected={resourceNeedsAttention}
        onPress={async () => {
          if (resourceUpdateChecking || resourceUpdateApplying) return;
          const hasUpdate = resourceUpdateAvailable
            ? resourceUpdateItems.length > 0
            : await checkResourceUpdates();
          if (!hasUpdate) {
            if (resourceAnnouncement && resourceAnnouncementActive) {
              showAnnouncementPrompt();
              return;
            }
            Alert.alert(
              resolveUiText(locale, "已是最新", "Up to date"),
              resolveUiText(locale, "当前本地资源已是最新。", "Your local resources are already up to date."),
            );
            return;
          }
          setResourceUpdateSheetOpen(true);
        }}
      />
      <ResourceUpdateSheet
        visible={resourceUpdateSheetOpen}
        locale={locale}
        items={resourceUpdateItems}
        downloadMusicUpdate={downloadMusicCatalogUpdate}
        onClose={() => {
          if (resourceUpdateProgress.phase === "downloading") return;
          setResourceUpdateSheetOpen(false);
          void checkResourceUpdates();
        }}
        onComplete={(failedCount) => {
          void checkResourceUpdates().then(() => {
            if (failedCount > 0) return;
            setResourceUpdateSheetOpen(false);
          });
        }}
      />
      <View style={styles.compactGap} />
      <ShellNavDrawerMenuRow
        label={resolveUiText(locale, "欢迎页", "Welcome page")}
        onPress={async () => {
          closeMenu();
          await resetOnboardingDevotionIntro();
          requestOpenOnboardingDevotionIntro();
        }}
      />
      <View style={styles.compactGap} />
      {memberAuthEnabled ? (
        <>
          {user ? (
            <>
              <ShellNavDrawerMenuRow
                label={t("auth.drawerSignedIn")}
                detail={user.name ?? user.email ?? undefined}
                onPress={() => closeMenu()}
              />
              <View style={styles.compactGap} />
              <ShellNavDrawerMenuRow
                label={t("auth.drawerLogout")}
                onPress={() => {
                  closeMenu();
                  void signOut();
                }}
              />
              <View style={styles.compactGap} />
              <ShellNavDrawerMenuRow
                label={t("auth.deleteAccount")}
                destructive
                onPress={confirmDeleteAccount}
              />
              <View style={styles.compactGap} />
            </>
          ) : (
            <>
              <ShellNavDrawerMenuRow
                label={t("auth.drawerLogin")}
                onPress={() => {
                  closeMenu();
                  router.push("/login");
                }}
              />
              <View style={styles.compactGap} />
              <ShellNavDrawerMenuRow
                label={t("auth.drawerRegister")}
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
        label={t("feedback.menuAction")}
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
    </ScrollView>
  );
}
