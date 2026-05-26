import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Speech from "expo-speech";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import Slider from "@react-native-community/slider";
import { parchmentSans } from "../fonts/parchmentType";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type AppLocale } from "../i18n/config";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveLocalizedField } from "../i18n/site-copy";
import {
  getTelemetryConsent,
  hydrateTelemetryConsent,
  setTelemetryConsent,
  subscribeTelemetryConsent,
} from "../telemetry/consent";
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
  checkNatureResourcePackUpdate,
  ensureNatureResourcePackSync,
} from "../media/natureResourcePackSync";
import {
  fetchMobileContentManifest,
  type MobileContentManifestAnnouncement,
} from "../api/mobileContentManifest";
import { requestOpenOnboardingDevotionIntro } from "../onboarding/onboarding-devotion-gate";
import { resetOnboardingDevotionIntro } from "../onboarding/onboarding-devotion-prefs";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import {
  dismissUpdateAnnouncementForever,
  shouldShowUpdateAnnouncement,
  snoozeUpdateAnnouncement,
} from "../updates/updateAnnouncementPrefs";
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
  setLocale: (next: AppLocale) => void;
  zh: boolean;
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

function LocaleInlineRow({ locale, setLocale, zh }: LocaleInlineRowProps) {
  return (
    <View style={[styles.row, styles.rowInline]}>
      <Text style={styles.rowText}>{zh ? "语言" : "Language"}</Text>
      <View style={styles.localeInlineGroup}>
        <Pressable
          onPress={() => setLocale("zh-CN")}
          style={[styles.localeInlineChip, locale === "zh-CN" && styles.localeInlineChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: locale === "zh-CN" }}
          accessibilityLabel="中文"
        >
          <Text style={[styles.localeInlineText, locale === "zh-CN" && styles.localeInlineTextActive]}>中文</Text>
        </Pressable>
        <Pressable
          onPress={() => setLocale("en")}
          style={[styles.localeInlineChip, locale === "en" && styles.localeInlineChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: locale === "en" }}
          accessibilityLabel="English"
        >
          <Text style={[styles.localeInlineText, locale === "en" && styles.localeInlineTextActive]}>EN</Text>
        </Pressable>
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

  const panelW = drawerWidth();
  const slideX = useRef(new Animated.Value(-panelW)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const telemetryConsent = useSyncExternalStore(
    subscribeTelemetryConsent,
    getTelemetryConsent,
    () => "unknown",
  );
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
  const [resourceUpdateApplying, setResourceUpdateApplying] = useState(false);
  const [resourceUpdateAvailable, setResourceUpdateAvailable] = useState(false);
  const [resourceAnnouncement, setResourceAnnouncement] = useState<MobileContentManifestAnnouncement | null>(null);
  const [resourceAnnouncementActive, setResourceAnnouncementActive] = useState(false);
  const {
    checkMusicCatalogUpdate,
    downloadMusicCatalogUpdate,
  } = useMusicPlayback();

  useEffect(() => {
    void hydrateTelemetryConsent();
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

  const checkResourceUpdates = async () => {
    if (resourceUpdateChecking || resourceUpdateApplying) return false;
    setResourceUpdateChecking(true);
    try {
      const [nature, music] = await Promise.all([
        checkNatureResourcePackUpdate().then((x) => x.available),
        checkMusicCatalogUpdate(),
      ]);
      const available = nature || music;
      setResourceUpdateAvailable(available);
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
  const telemetryDetail =
    telemetryConsent === "granted"
      ? zh
        ? "已开启，感谢你帮助我们持续优化"
        : "Enabled, thanks for helping us improve"
      : telemetryConsent === "denied"
        ? zh
          ? "已关闭（可随时重新开启）"
          : "Disabled (you can enable anytime)"
        : zh
          ? "建议开启：帮助我们持续优化体验"
          : "Recommended: help improve your experience";

  const toggleTelemetryConsent = () => {
    if (telemetryConsent === "granted") {
      Alert.alert(
        zh ? "关闭匿名优化统计" : "Disable anonymous insights",
        zh ? "关闭后将停止上报匿名使用指标，你仍可随时在这里重新开启。" : "Anonymous usage insights will stop. You can enable again anytime.",
        [
          { text: zh ? "取消" : "Cancel", style: "cancel" },
          {
            text: zh ? "关闭" : "Disable",
            style: "destructive",
            onPress: () => {
              void setTelemetryConsent("denied");
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      zh ? "帮助我们持续优化体验" : "Help us improve your experience",
      zh
        ? "仅收集匿名基础指标（打开次数、使用时长、页面访问），不会用于广告追踪。"
        : "We only collect anonymous basics (opens, session duration, screen views), never ad tracking.",
      [
        { text: zh ? "取消" : "Cancel", style: "cancel" },
        {
          text: zh ? "同意并开启" : "Agree and enable",
          onPress: () => {
            void setTelemetryConsent("granted");
          },
        },
      ],
    );
  };

  const persistTtsPrefs = (next: { rateLevel: NatureHomeTtsLevel; pitchLevel: NatureHomeTtsLevel; voiceId: string }) => {
    setTtsRateLevel(next.rateLevel);
    setTtsPitchLevel(next.pitchLevel);
    setTtsVoiceId(next.voiceId);
    void writeNatureHomeTtsPrefs(next);
  };

  const rateLabel = zh
    ? ["很慢", "偏慢", "标准", "偏快", "很快"][ttsRateLevel]
    : ["Very slow", "Slow", "Normal", "Fast", "Very fast"][ttsRateLevel];
  const pitchLabel = zh
    ? ["很低", "偏低", "标准", "偏高", "很高"][ttsPitchLevel]
    : ["Very low", "Low", "Normal", "High", "Very high"][ttsPitchLevel];
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
  const resourceNeedsAttention = resourceUpdateAvailable || resourceAnnouncementActive;
  const resourceUpdateDetail = resourceUpdateApplying
    ? zh
      ? "更新中…"
      : "Updating..."
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
          ? "发现新资源"
          : "New resources available"
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

              <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <LocaleInlineRow locale={locale} setLocale={setLocale} zh={zh} />
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
                      <Slider
                        style={styles.ttsSlider}
                        minimumValue={0}
                        maximumValue={4}
                        step={1}
                        value={ttsRateLevel}
                        minimumTrackTintColor="rgba(255, 177, 1, 0.9)"
                        maximumTrackTintColor="rgba(120, 53, 15, 0.25)"
                        thumbTintColor="#C28A2A"
                        onValueChange={(value) => setTtsRateLevel(TTS_LEVELS[Math.round(value)] ?? 2)}
                        onSlidingComplete={(value) => {
                          const nextRate = TTS_LEVELS[Math.round(value)] ?? 2;
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
                      <Slider
                        style={styles.ttsSlider}
                        minimumValue={0}
                        maximumValue={4}
                        step={1}
                        value={ttsPitchLevel}
                        minimumTrackTintColor="rgba(255, 177, 1, 0.9)"
                        maximumTrackTintColor="rgba(120, 53, 15, 0.25)"
                        thumbTintColor="#C28A2A"
                        onValueChange={(value) => setTtsPitchLevel(TTS_LEVELS[Math.round(value)] ?? 2)}
                        onSlidingComplete={(value) => {
                          const nextPitch = TTS_LEVELS[Math.round(value)] ?? 2;
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
                    const hasUpdate = await checkResourceUpdates();
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
                    Alert.alert(
                      zh ? "发现新资源" : "New resources found",
                      zh
                        ? `检测到场景/音乐有新版本，是否现在下载更新？${resourceAnnouncementActive ? "\n\n另有一条更新通知，可稍后在此查看。" : ""}`
                        : `New scene/music versions are available. Download now?${resourceAnnouncementActive ? "\n\nThere is also an update notice you can review later." : ""}`,
                      [
                        { text: zh ? "稍后" : "Later", style: "cancel" },
                        {
                          text: zh ? "更新" : "Update",
                          onPress: () => {
                            void (async () => {
                              setResourceUpdateApplying(true);
                              try {
                                const [nature, music] = await Promise.all([
                                  checkNatureResourcePackUpdate().then((x) => x.available),
                                  checkMusicCatalogUpdate(),
                                ]);
                                if (nature) await ensureNatureResourcePackSync();
                                if (music) await downloadMusicCatalogUpdate();
                                const latest = await checkResourceUpdates();
                                Alert.alert(
                                  latest ? (zh ? "部分未更新" : "Partially updated") : (zh ? "更新完成" : "Update complete"),
                                  latest
                                    ? (zh ? "仍有资源待更新，请稍后重试。" : "Some resources are still pending. Please try again later.")
                                    : (zh ? "本地资源已更新到最新。" : "Local resources are now up to date."),
                                );
                              } finally {
                                setResourceUpdateApplying(false);
                              }
                            })();
                          },
                        },
                      ],
                    );
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
                <MenuRow
                  label={zh ? "帮助我们优化（匿名）" : "Help us improve (anonymous)"}
                  detail={telemetryDetail}
                  onPress={toggleTelemetryConsent}
                />
                <View style={styles.compactGap} />
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
  ttsSlider: {
    width: "100%",
    height: 28,
    marginBottom: 2,
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
    gap: 6,
  },
  localeInlineChip: {
    minWidth: 42,
    paddingHorizontal: 8,
    minHeight: 24,
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
  localeInlineText: {
    fontSize: 12,
    color: "rgba(55, 53, 47, 0.72)",
    ...parchmentSans(600),
  },
  localeInlineTextActive: {
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
