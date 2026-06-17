import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/site-copy";
import { READ_PARCHMENT_PAGE_BOTTOM } from "../read/ReadParchmentPageScroll";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { useExploreScrollContentStyle } from "./exploreParchmentStyles";
import { defaultBirthDate, isValidBirthDate, type ExploreBirthDate } from "./explore-birth-date";
import {
  isValidExploreDisplayName,
  normalizeExploreDisplayName,
  readExploreYearDayProfile,
  writeExploreYearDayProfile,
} from "./explore-birth-year-prefs";
import { dismissRequiredYearDayBirthProfilePrompt } from "./explore-year-day-birth-prompt-session";

type Args = {
  embedded?: boolean;
  requiredProp?: boolean;
  onClose?: () => void;
  onSaved?: () => void;
};

export function useExploreBirthYearSettingsScreen({
  embedded = false,
  requiredProp,
  onClose,
  onSaved,
}: Args = {}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: READ_PARCHMENT_PAGE_BOTTOM + insets.bottom,
  });
  const { required: requiredParam } = useLocalSearchParams<{ required?: string }>();
  const required = requiredProp ?? requiredParam === "1";
  const didSaveRef = useRef(false);

  const [selectedDate, setSelectedDate] = useState<ExploreBirthDate>(() => defaultBirthDate());
  const [displayName, setDisplayName] = useState("");
  const [weddingAnniversary, setWeddingAnniversary] = useState<ExploreBirthDate | null>(null);
  const [baptismDate, setBaptismDate] = useState<ExploreBirthDate | null>(null);
  const [sheetScrollEnabled, setSheetScrollEnabled] = useState(true);

  useShellSwipeSuspend(!embedded);

  useEffect(() => {
    if (embedded) return;
    const unsub = navigation.addListener("beforeRemove", () => {
      if (!didSaveRef.current) {
        dismissRequiredYearDayBirthProfilePrompt();
      }
    });
    return unsub;
  }, [embedded, navigation]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readExploreYearDayProfile().then((profile) => {
        if (cancelled) return;
        setSelectedDate(profile.birthDate ?? defaultBirthDate());
        setDisplayName(profile.displayName ?? "");
        setWeddingAnniversary(profile.weddingAnniversary);
        setBaptismDate(profile.baptismDate);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  const nameValid = useMemo(() => isValidExploreDisplayName(displayName), [displayName]);
  const dateValid = useMemo(() => isValidBirthDate(selectedDate), [selectedDate]);
  const weddingValid = useMemo(
    () => weddingAnniversary == null || isValidBirthDate(weddingAnniversary),
    [weddingAnniversary],
  );
  const baptismValid = useMemo(
    () => baptismDate == null || isValidBirthDate(baptismDate),
    [baptismDate],
  );
  const canSave = nameValid && dateValid && weddingValid && baptismValid;

  const finishClose = useCallback(() => {
    dismissRequiredYearDayBirthProfilePrompt();
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/explore/year-day-count");
  }, [onClose, router]);

  const close = useCallback(() => {
    finishClose();
  }, [finishClose]);

  const saveProfile = useCallback(async () => {
    if (!canSave) return;
    await writeExploreYearDayProfile({
      birthDate: selectedDate,
      displayName: normalizeExploreDisplayName(displayName),
      weddingAnniversary,
      baptismDate,
    });
    didSaveRef.current = true;
    if (onSaved) {
      onSaved();
      return;
    }
    finishClose();
  }, [
    baptismDate,
    canSave,
    displayName,
    finishClose,
    onSaved,
    selectedDate,
    weddingAnniversary,
  ]);

  const suspendSheetScroll = useCallback(() => setSheetScrollEnabled(false), []);
  const resumeSheetScroll = useCallback(() => setSheetScrollEnabled(true), []);
  const hint = t("pages.explore.birthYearModalHint");

  return {
    embedded,
    required,
    scrollContentStyle,
    selectedDate,
    setSelectedDate,
    displayName,
    setDisplayName,
    weddingAnniversary,
    setWeddingAnniversary,
    baptismDate,
    setBaptismDate,
    sheetScrollEnabled,
    canSave,
    close,
    saveProfile,
    suspendSheetScroll,
    resumeSheetScroll,
    hint,
  };
}
