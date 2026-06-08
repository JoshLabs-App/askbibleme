import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Speech from "expo-speech";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type AppLocale } from "../i18n/config";
import { getLocalePickerLabel } from "../i18n/locale-display-labels";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveLocalizedField } from "../i18n/site-copy";
import {
  HOME_VERSE_POOL_SCOPE_OPTIONS,
  type HomeVersePoolScopeId,
} from "../explore/explore-home-verse-pool-scopes";
import {
  getHomeTtsExperimentEnabled,
  hydrateHomeTtsExperiment,
  setHomeTtsExperimentEnabled,
  subscribeHomeTtsExperiment,
} from "../home/homeExperimentalFeatures";
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
  setHomeVersePoolScope,
  subscribeHomeVersePoolScope,
} from "../home/homeVersePoolScopePrefs";
import {
  readNatureHomeTtsPrefs,
  writeNatureHomeTtsPrefs,
  type NatureHomeTtsLevel,
} from "../home/natureHomePrefs";
import {
  checkMobileResourceUpdates,
  readMobileResourceUpdateState,
  subscribeMobileResourceUpdate,
  type MobileResourceUpdateItem,
} from "../updates/mobileResourceUpdate";
import { ResourceUpdateSheet } from "../updates/ResourceUpdateSheet";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  fetchMobileContentManifest,
  type MobileContentManifestAnnouncement,
} from "../api/mobileContentManifest";
import { fetchBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import { resolveDefaultPrimaryTranslationId, writeReadBibleTranslationPrefs, writeReadBibleTranslationPrefMode } from "../read/read-bible-translation-prefs";
import { readHomePrayerVersePrefs, writeHomePrayerVersePrefs } from "../home/homePrayerVersePrefs";
import { requestOpenOnboardingDevotionIntro } from "../onboarding/onboarding-devotion-gate";
import { resetOnboardingDevotionIntro } from "../onboarding/onboarding-devotion-prefs";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import {
  dismissUpdateAnnouncementForever,
  shouldShowUpdateAnnouncement,
  snoozeUpdateAnnouncement,
} from "../updates/updateAnnouncementPrefs";
import { useMemberAuth } from "../auth/MemberAuthProvider";
import {
  getMemberRegisterEnabled,
  subscribeMemberRegisterEnabled,
} from "../auth/member-register-enabled";
import { useShellNavMenu } from "./ShellNavMenuContext";
import { useShellSwipeSuspend } from "./useShellSwipeSuspend";

const DRAWER_ANIM_MS = 300;
const DRAWER_EASING = Easing.out(Easing.cubic);
const parchmentSource = require("../../assets/images/read-parchment-scroll-bg.jpg");
const SUPPORT_EMAIL = "askbibleme@gmail.com";
const TTS_LEVELS: readonly NatureHomeTtsLevel[] = [0, 1, 2, 3, 4];

function drawerWidth(): number {
  const w = Dimensions.get("window").width;
  return Math.min(360, Math.max(280, w - 28));
}

type MenuRowProps = {
  label: string;
  onPress: () => void;
  detail?: string;
  selected?: boolean;
};

function MenuRow({ label, onPress, detail, selected }: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
    >
      <Text style={styles.rowText}>{label}</Text>
      {detail ? <Text style={[styles.rowDetail, selected && styles.rowDetailSelected]}>{detail}</Text> : null}
    </Pressable>
  );
}

type LocaleInlineRowProps = {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  zh: boolean;
  switching: boolean;
};

type DeviceVoice = { identifier: string; name?: string; language?: string };

function compactVoiceName(voice: DeviceVoice): string {
  const raw = (voice.name?.trim() || voice.identifier || "").trim();
  if (!raw) return "Voice";
  const normalized = raw.replace(/\s+/g, " ");
  const firstWord = normalized.split(" ")[0]?.trim() || normalized;
  return firstWord.length > 10 ? firstWord.slice(0, 10) : firstWord;
}

function inferVoiceGender(voice: DeviceVoice): "female" | "male" | "unknown" {
  const text = `${voice.name || ""} ${voice.identifier || ""}`.toLowerCase();
  if (
    /\bfemale\b|\bwoman\b|girl|tingting|meijia|samantha|victoria|karen|siri_female|xiaoyi/.test(
      text,
    )
  ) {
    return "female";
  }
  if (
    /\bmale\b|\bman\b|boy|alex|daniel|tom|fred|siri_male|yunxi|yunjian|tian-tian/.test(
      text,
    )
  ) {
    return "male";
  }
  return "unknown";
}

function TtsLevelStepPicker({
  value,
  onChange,
  labelForLevel,
}: {
  value: NatureHomeTtsLevel;
  onChange: (level: NatureHomeTtsLevel) => void;
  labelForLevel: (level: NatureHomeTtsLevel) => string;
}) {
  return (
    <View style={styles.ttsStepTrack} accessibilityRole="radiogroup">
      <View style={styles.ttsStepRail} pointerEvents="none" />
      {TTS_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <Pressable
            key={level}
            onPress={() => onChange(level)}
            style={styles.ttsStepHit}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={labelForLevel(level)}
          >
            <View style={[styles.ttsStepThumb, selected && styles.ttsStepThumbActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function LocaleInlineRow({ locale, onLocaleChange, zh, switching }: LocaleInlineRowProps) {
  return (
    <View style={[styles.row, styles.rowInline]}>
      <Text style={styles.rowText}>{zh ? "语言" : "Language"}</Text>
      <View style={styles.localeInlineGroup}>
        {(["en", "zh-TW", "zh-CN"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => onLocaleChange(item)}
            style={[styles.localeInlineChip, locale === item && styles.localeInlineChipActive]}
            disabled={switching}
            accessibilityRole="button"
            accessibilityState={{ selected: locale === item }}
            accessibilityLabel={getLocalePickerLabel(item)}
          >
            <Text style={[styles.localeInlineLabel, locale === item && styles.localeInlineLabelActive]}>
              {getLocalePickerLabel(item)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** 左上用户菜单：自左侧全高滑出（对齐网站 / X 式抽屉，非 Tab 导航） */
export function ShellNavDrawer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, setLocale, t } = useLocale();
  const { open, closeMenu } = useShellNavMenu();
  useShellSwipeSuspend(open);
  const memberAuthEnabled = useSyncExternalStore(
    subscribeMemberRegisterEnabled,
    getMemberRegisterEnabled,
    getMemberRegisterEnabled,
  );
  const { user, signOut } = useMemberAuth();

  const panelW = drawerWidth();
  const slideX = useRef(new Animated.Value(-panelW)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
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
  const [ttsRateLevel, setTtsRateLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsPitchLevel, setTtsPitchLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsVoices, setTtsVoices] = useState<DeviceVoice[]>([]);
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const [resourceUpdateChecking, setResourceUpdateChecking] = useState(false);
  const [resourceUpdateAvailable, setResourceUpdateAvailable] = useState(false);
  const [resourceUpdateItems, setResourceUpdateItems] = useState<MobileResourceUpdateItem[]>([]);
  const [resourceUpdateSheetOpen, setResourceUpdateSheetOpen] = useState(false);
  const [resourceUpdateProgress, setResourceUpdateProgress] = useState(() => readMobileResourceUpdateState());
  const [resourceAnnouncement, setResourceAnnouncement] = useState<MobileContentManifestAnnouncement | null>(null);
  const [resourceAnnouncementActive, setResourceAnnouncementActive] = useState(false);
  const [localeSwitching, setLocaleSwitching] = useState(false);
  const {
    checkMusicCatalogUpdate,
    downloadMusicCatalogUpdate,
  } = useMusicPlayback();

  useEffect(() => {
    void hydrateHomeTtsExperiment();
    void hydrateHomeVersePoolScope();
  }, []);

  useEffect(() => {
    if (!open || !homeTtsExperimentEnabled) return;
    let alive = true;
    void (async () => {
      const prefs = await readNatureHomeTtsPrefs();
      const voicesRaw = (await Speech.getAvailableVoicesAsync().catch(() => [])) as DeviceVoice[];
      if (!alive) return;
      setTtsRateLevel(prefs.rateLevel);
      setTtsPitchLevel(prefs.pitchLevel);
      setTtsVoiceId(prefs.voiceId);
      const langPrefix = locale === "en" ? "en" : "zh";
      const validVoices = voicesRaw.filter((voice) => typeof voice.identifier === "string" && voice.identifier.trim());
      const preferredVoices = validVoices.filter((voice) =>
        String(voice.language || "")
          .toLowerCase()
          .startsWith(langPrefix),
      );
      setTtsVoices(preferredVoices.length > 0 ? preferredVoices : validVoices);
    })();
    return () => {
      alive = false;
    };
  }, [open, homeTtsExperimentEnabled, locale]);

  useEffect(() => {
    if (open) {
      slideX.setValue(-panelW);
      setVisible(true);
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: DRAWER_ANIM_MS,
          easing: DRAWER_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: DRAWER_ANIM_MS,
          easing: DRAWER_EASING,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!visible) return;
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -panelW,
        duration: DRAWER_ANIM_MS,
        easing: DRAWER_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: DRAWER_ANIM_MS,
        easing: DRAWER_EASING,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [open, panelW, slideX, backdropOpacity, visible]);

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
      const items = await checkMobileResourceUpdates({
        isMusicUpdateAvailable: checkMusicCatalogUpdate,
      });
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
    void checkResourceUpdates();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
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
    return () => {
      alive = false;
    };
  }, [open]);

  const zh = locale !== "en";

  const persistTtsPrefs = (next: { rateLevel: NatureHomeTtsLevel; pitchLevel: NatureHomeTtsLevel; voiceId: string }) => {
    setTtsRateLevel(next.rateLevel);
    setTtsPitchLevel(next.pitchLevel);
    setTtsVoiceId(next.voiceId);
    void writeNatureHomeTtsPrefs(next);
  };

  const rateLabels = zh
    ? (["很慢", "偏慢", "标准", "偏快", "很快"] as const)
    : (["Very slow", "Slow", "Normal", "Fast", "Very fast"] as const);
  const pitchLabels = zh
    ? (["很低", "偏低", "标准", "偏高", "很高"] as const)
    : (["Very low", "Low", "Normal", "High", "Very high"] as const);
  const rateLabel = rateLabels[ttsRateLevel] ?? rateLabels[2];
  const pitchLabel = pitchLabels[ttsPitchLevel] ?? pitchLabels[2];
  const voiceOptions = [
    { id: "", label: zh ? "系统默认" : "System default", gender: "unknown" as const },
    ...ttsVoices.map((voice) => ({
      id: voice.identifier,
      label: compactVoiceName(voice),
      gender: inferVoiceGender(voice),
    })),
  ];
  const currentPool =
    HOME_VERSE_POOL_SCOPE_OPTIONS.find((scope) => scope.id === homeVersePoolScope) ??
    HOME_VERSE_POOL_SCOPE_OPTIONS[0];
  const resourceUpdateApplying = resourceUpdateProgress.phase === "downloading";
  const resourceNeedsAttention = resourceUpdateAvailable || resourceAnnouncementActive;
  const resourceUpdateDetail = resourceUpdateApplying
    ? zh
      ? `下载中 ${resourceUpdateProgress.overallPercent}%`
      : `Downloading ${resourceUpdateProgress.overallPercent}%`
    : resourceUpdateChecking
      ? zh
        ? "检查中…"
        : "Checking..."
      : resourceUpdateAvailable && resourceAnnouncementActive
        ? zh
          ? "发现新资源与通知"
          : "New resources and notice"
        : resourceUpdateAvailable
          ? zh
            ? `${resourceUpdateItems.length} 项可更新`
            : `${resourceUpdateItems.length} updates`
          : resourceAnnouncementActive
            ? zh
              ? "有新通知"
              : "New notice"
            : zh
              ? "已是最新"
              : "Up to date";

  const showAnnouncementPrompt = () => {
    const announcement = resourceAnnouncement;
    if (!announcement || !resourceAnnouncementActive) return;
    const title = resolveLocalizedField(announcement.title, locale).trim();
    if (!title) return;
    const body = resolveLocalizedField(announcement.body, locale).trim();
    const actionLabel = resolveLocalizedField(announcement.actionLabel, locale).trim();
    const snoozeHours = announcement.snoozeHours ?? (announcement.level === "critical" ? 12 : 24);
    const buttons: { text: string; style?: "cancel" | "default" | "destructive"; onPress?: () => void }[] = [
      {
        text: zh ? "稍后提醒" : "Remind later",
        style: "cancel",
        onPress: () => {
          void snoozeUpdateAnnouncement(announcement.announcementId, snoozeHours);
          setResourceAnnouncementActive(false);
        },
      },
    ];
    if (announcement.allowDismissForever !== false) {
      buttons.push({
        text: zh ? "不再提示" : "Don't remind again",
        style: "destructive",
        onPress: () => {
          void dismissUpdateAnnouncementForever(announcement.announcementId);
          setResourceAnnouncementActive(false);
        },
      });
    }
    if (announcement.actionUrl) {
      buttons.push({
        text: actionLabel || (zh ? "查看详情" : "View details"),
        onPress: () => {
          void Linking.openURL(announcement.actionUrl as string).catch(() => undefined);
          void snoozeUpdateAnnouncement(announcement.announcementId, 6);
          setResourceAnnouncementActive(false);
        },
      });
    }
    Alert.alert(title, body || (zh ? "你可以稍后再处理此提醒。" : "You can handle this reminder later."), buttons);
  };

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
            source={parchmentSource}
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

              <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <LocaleInlineRow locale={locale} onLocaleChange={handleLocaleChange} zh={zh} switching={localeSwitching} />
                <View style={styles.compactGap} />
                <Text style={styles.sectionLabelCompact}>{zh ? "主页经文池" : "Home verse pool"}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.poolSelectTrigger,
                    pressed ? styles.poolSelectTriggerPressed : null,
                  ]}
                  onPress={() => setPoolPickerOpen((v) => !v)}
                >
                  <Text style={styles.poolSelectLabel}>{zh ? "当前选择" : "Current"}</Text>
                  <View style={styles.poolSelectValueWrap}>
                    <Text style={styles.poolSelectValue}>
                      {zh ? currentPool.labelZh : currentPool.labelEn}
                    </Text>
                    <MaterialIcons
                      name={poolPickerOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                      size={16}
                      color="rgba(85, 64, 36, 0.72)"
                    />
                  </View>
                </Pressable>
                {poolPickerOpen ? (
                  <View style={styles.poolSelectOptions}>
                    {HOME_VERSE_POOL_SCOPE_OPTIONS.map((scope) => {
                      const selected = homeVersePoolScope === scope.id;
                      return (
                        <Pressable
                          key={scope.id}
                          style={[styles.poolSelectOption, selected ? styles.poolSelectOptionActive : null]}
                          onPress={() => {
                            setPoolPickerOpen(false);
                            void setHomeVersePoolScope(scope.id as HomeVersePoolScopeId);
                          }}
                        >
                          <Text
                            style={[
                              styles.poolSelectOptionText,
                              selected ? styles.poolSelectOptionTextActive : null,
                            ]}
                          >
                            {zh ? scope.labelZh : scope.labelEn}
                          </Text>
                          {selected ? (
                            <MaterialIcons name="check" size={14} color="#A56A2D" />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.compactGap} />
                <Text style={styles.sectionLabelCompact}>{zh ? "实验功能" : "Experimental features"}</Text>
                <Pressable
                  style={({ pressed }) => [styles.ttsMasterRow, pressed ? styles.ttsMasterRowPressed : null]}
                  onPress={() => {
                    void setHomeTtsExperimentEnabled(!homeTtsExperimentEnabled);
                  }}
                >
                  <Text style={styles.ttsMasterLabel}>
                    {zh ? "尝试TTS读经文（实验）" : "Try TTS verse reading (experimental)"}
                  </Text>
                  <Text style={styles.ttsMasterDetail}>
                    {homeTtsExperimentEnabled ? (zh ? "已开启" : "Enabled") : zh ? "已关闭" : "Disabled"}
                  </Text>
                </Pressable>
                {homeTtsExperimentEnabled ? (
                  <View style={styles.ttsControlsWrap}>
                      <View style={styles.ttsSliderRow}>
                        <Text style={styles.ttsSliderLabel}>{zh ? "语速" : "Speed"}</Text>
                        <Text style={styles.ttsSliderValue}>{rateLabel}</Text>
                      </View>
                      <TtsLevelStepPicker
                        value={ttsRateLevel}
                        labelForLevel={(level) => rateLabels[level] ?? rateLabels[2]}
                        onChange={(nextRate) => {
                          persistTtsPrefs({
                            rateLevel: nextRate,
                            pitchLevel: ttsPitchLevel,
                            voiceId: ttsVoiceId,
                          });
                        }}
                      />

                      <View style={styles.ttsSliderRow}>
                        <Text style={styles.ttsSliderLabel}>{zh ? "音调" : "Pitch"}</Text>
                        <Text style={styles.ttsSliderValue}>{pitchLabel}</Text>
                      </View>
                      <TtsLevelStepPicker
                        value={ttsPitchLevel}
                        labelForLevel={(level) => pitchLabels[level] ?? pitchLabels[2]}
                        onChange={(nextPitch) => {
                          persistTtsPrefs({
                            rateLevel: ttsRateLevel,
                            pitchLevel: nextPitch,
                            voiceId: ttsVoiceId,
                          });
                        }}
                      />

                      <View style={styles.ttsVoiceRow}>
                        <Text style={styles.ttsSliderLabel}>{zh ? "声音" : "Voices"}</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.ttsVoiceList}
                          style={styles.ttsVoiceScroll}
                        >
                          {voiceOptions.map((voice) => {
                            const selected = ttsVoiceId === voice.id;
                            const iconName =
                              voice.id === ""
                                ? "cog-outline"
                                : voice.gender === "female"
                                  ? "face-woman-profile"
                                  : voice.gender === "male"
                                    ? "face-man-profile"
                                    : "account-circle";
                            return (
                              <Pressable
                                key={voice.id || "__default_voice__"}
                                style={[styles.ttsVoiceChip, selected && styles.ttsVoiceChipSelected]}
                                onPress={() => {
                                  persistTtsPrefs({
                                    rateLevel: ttsRateLevel,
                                    pitchLevel: ttsPitchLevel,
                                    voiceId: voice.id,
                                  });
                                }}
                              >
                                <MaterialCommunityIcons
                                  name={iconName}
                                  size={14}
                                  color={selected ? "#A56A2D" : "rgba(85, 64, 36, 0.72)"}
                                />
                                <Text style={[styles.ttsVoiceChipText, selected && styles.ttsVoiceChipTextSelected]}>
                                  {voice.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                  </View>
                ) : null}
                <View style={styles.compactGap} />
                <MenuRow
                  label={zh ? "资源更新" : "Resource updates"}
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
                        zh ? "已是最新" : "Up to date",
                        zh ? "当前本地资源已是最新。" : "Your local resources are already up to date.",
                      );
                      return;
                    }
                    setResourceUpdateSheetOpen(true);
                  }}
                />
                <ResourceUpdateSheet
                  visible={resourceUpdateSheetOpen}
                  zh={zh}
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
                <MenuRow
                  label={zh ? "欢迎页" : "Welcome page"}
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
                        <MenuRow
                          label={t("auth.drawerSignedIn")}
                          detail={user.name || user.email}
                          onPress={() => closeMenu()}
                        />
                        <View style={styles.compactGap} />
                        <MenuRow
                          label={t("auth.drawerLogout")}
                          onPress={() => {
                            closeMenu();
                            void signOut();
                          }}
                        />
                        <View style={styles.compactGap} />
                      </>
                    ) : (
                      <>
                        <MenuRow
                          label={t("auth.drawerLogin")}
                          onPress={() => {
                            closeMenu();
                            router.push("/login");
                          }}
                        />
                        <View style={styles.compactGap} />
                        <MenuRow
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
                <MenuRow
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
              </ScrollView>
            </View>
          </ImageBackground>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(236, 217, 185, 0.66)",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(120, 53, 15, 0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 16,
    overflow: "hidden",
  },
  drawerBg: {
    flex: 1,
    backgroundColor: "rgba(236, 217, 185, 0.62)",
  },
  drawerBgImage: {
    opacity: 0.92,
  },
  drawerContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 6,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 14,
    ...parchmentSans(600),
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.55)",
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  closeBtnPressed: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  scroll: {
    flex: 1,
  },
  compactGap: {
    height: 4,
  },
  sectionLabelCompact: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.46)",
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  poolSelectTrigger: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.2)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  poolSelectTriggerPressed: {
    backgroundColor: "rgba(255, 177, 1, 0.14)",
  },
  poolSelectLabel: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.72)",
  },
  poolSelectValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  poolSelectValue: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.9)",
    ...parchmentSans(600),
  },
  poolSelectOptions: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.2)",
    backgroundColor: "rgba(255, 248, 235, 0.58)",
    overflow: "hidden",
  },
  poolSelectOption: {
    minHeight: 30,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(120, 53, 15, 0.12)",
  },
  poolSelectOptionActive: {
    backgroundColor: "rgba(255, 177, 1, 0.16)",
  },
  poolSelectOptionText: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.82)",
  },
  poolSelectOptionTextActive: {
    color: "rgba(120, 75, 30, 0.96)",
    ...parchmentSans(600),
  },
  ttsMasterRow: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.2)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ttsMasterRowPressed: {
    backgroundColor: "rgba(255, 177, 1, 0.14)",
  },
  ttsMasterLabel: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.86)",
    ...parchmentSans(600),
  },
  ttsMasterDetail: {
    fontSize: 12,
    color: "rgba(120, 95, 60, 0.85)",
  },
  ttsControlsWrap: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.18)",
    backgroundColor: "rgba(255, 248, 235, 0.28)",
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  ttsSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ttsSliderLabel: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.82)",
    ...parchmentSans(600),
  },
  ttsSliderValue: {
    fontSize: 12,
    color: "rgba(120, 95, 60, 0.85)",
  },
  ttsStepTrack: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    minHeight: 36,
    position: "relative",
  },
  ttsStepRail: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "50%",
    marginTop: -1,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(120, 53, 15, 0.2)",
  },
  ttsStepHit: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  ttsStepThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.35)",
    backgroundColor: "rgba(255, 248, 235, 0.95)",
  },
  ttsStepThumbActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderColor: "#C28A2A",
    backgroundColor: "rgba(255, 177, 1, 0.92)",
  },
  ttsVoiceRow: {
    marginTop: 2,
  },
  ttsVoiceScroll: {
    width: "100%",
    marginTop: 4,
  },
  ttsVoiceList: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 4,
  },
  ttsVoiceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.24)",
    backgroundColor: "rgba(255, 248, 235, 0.62)",
    paddingHorizontal: 8,
  },
  ttsVoiceChipSelected: {
    borderColor: "rgba(255, 177, 1, 0.8)",
    backgroundColor: "rgba(255, 177, 1, 0.2)",
  },
  ttsVoiceChipText: {
    fontSize: 12,
    color: "rgba(55, 53, 47, 0.78)",
    ...parchmentSans(600),
  },
  ttsVoiceChipTextSelected: {
    color: "rgba(120, 75, 30, 0.96)",
  },
  sectionLabel: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.52)",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  languageHint: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(55, 53, 47, 0.58)",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionDivider: {
    marginTop: 8,
    marginBottom: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(120, 53, 15, 0.18)",
  },
  row: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 2,
  },
  rowInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  localeInlineGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  localeInlineChip: {
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.24)",
    backgroundColor: "rgba(255, 248, 235, 0.45)",
  },
  localeInlineChipActive: {
    backgroundColor: "rgba(255, 177, 1, 0.18)",
    borderColor: "rgba(255, 177, 1, 0.75)",
  },
  localeInlineLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(55, 53, 47, 0.72)",
    ...parchmentSans(600),
  },
  localeInlineLabelActive: {
    color: "rgba(120, 75, 30, 0.95)",
  },
  rowSelected: {
    backgroundColor: "rgba(255, 248, 235, 0.42)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.18)",
  },
  rowPressed: {
    backgroundColor: "rgba(255, 244, 224, 0.72)",
  },
  rowText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#37352f",
  },
  rowDetail: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(55, 53, 47, 0.55)",
  },
  rowDetailSelected: {
    color: "rgba(120, 95, 60, 0.85)",
    ...parchmentSans(500),
  },
});
