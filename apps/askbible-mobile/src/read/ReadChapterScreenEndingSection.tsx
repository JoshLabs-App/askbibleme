import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import { readTypography } from "./readTypography";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";

type NavTarget = { bookId: string; chapter: number } | null;

type Props = {
  screenWidth: number;
  displayBookName: string;
  chapterCompleted: boolean;
  completedLabel: string;
  endNavPrev: NavTarget;
  endNavNext: NavTarget;
  formatNeighborChapterLabel: (target: NavTarget) => string;
  onGoPrev: () => void;
  onGoNext: () => void;
  onOpenCatalog: () => void;
};

export function ReadChapterScreenEndingSection({
  screenWidth,
  displayBookName,
  chapterCompleted,
  completedLabel,
  endNavPrev,
  endNavNext,
  formatNeighborChapterLabel,
  onGoPrev,
  onGoNext,
  onOpenCatalog,
}: Props) {
  return (
    <View style={styles.scriptureEndingSection}>
      <View style={styles.endNav}>
        <View style={styles.endSide}>
          {endNavPrev ? (
            <Pressable onPress={onGoPrev}>
              <View style={styles.endLinkRow}>
                <MaterialIcons name="chevron-left" size={16} color={readTypography.breadcrumbColor} />
                <Text style={styles.endLink}>{formatNeighborChapterLabel(endNavPrev)}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onOpenCatalog} style={styles.endCenter}>
          <Text style={styles.endCenterText}>{displayBookName}</Text>
        </Pressable>
        <View style={[styles.endSide, styles.endSideRight]}>
          {endNavNext ? (
            <Pressable onPress={onGoNext}>
              <View style={[styles.endLinkRow, styles.endLinkRowRight]}>
                <Text style={styles.endLink}>{formatNeighborChapterLabel(endNavNext)}</Text>
                <MaterialIcons name="chevron-right" size={16} color={readTypography.breadcrumbColor} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        style={[styles.scriptureClosingDivider, { width: screenWidth }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <LinearGradient
          colors={[
            "rgba(78, 52, 30, 0.22)",
            "rgba(78, 52, 30, 0.14)",
            "rgba(78, 52, 30, 0.07)",
            "rgba(78, 52, 30, 0.03)",
            "rgba(78, 52, 30, 0)",
          ]}
          locations={[0, 0.28, 0.58, 0.82, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.scriptureShadowGradient}
        />
      </View>

      {chapterCompleted ? (
        <View style={styles.chapterDoneWrap}>
          <View style={styles.chapterDoneRow}>
            <MaterialIcons name="check-circle" size={22} color="#6E835E" />
            <Text style={styles.chapterDoneText}>{completedLabel}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
