import { StyleSheet, View } from "react-native";
import { LOGO_TEXT_ACCENT_COLOR as LOGO_COLOR } from "../shell/logo-colors";
import { LIFE_BATTERY_SEGMENT_COUNT } from "./century-timeline";

type Props = {
  filledSegments: number;
};

const BORDER = 4;
const BODY_H = 72;
const BODY_W = 120;
const BODY_RADIUS = 12;
const INNER_PAD = 8;
const SEG_GAP = 5;
const CAP_GAP = 6;
const CAP_W = 9;
const CAP_H = 28;
const CAP_RADIUS = 5;

const SHELL_BORDER = "rgba(28, 20, 16, 0.58)";
const SHELL_FILL = "rgba(255, 252, 245, 0.92)";
const LIVED = LOGO_COLOR;
/** 状态栏常见满电绿 */
const REMAINING = "#34C759";

/** 人生 90 岁满格：5 格分段电池（每格 18 岁，四舍五入） */
export function ExploreLifeDayBattery({ filledSegments }: Props) {
  const filled = Math.min(
    LIFE_BATTERY_SEGMENT_COUNT,
    Math.max(0, Math.round(filledSegments)),
  );

  return (
    <View style={styles.shell} importantForAccessibility="no">
      <View style={styles.body}>
        <View style={styles.inner}>
          {Array.from({ length: LIFE_BATTERY_SEGMENT_COUNT }, (_, i) => (
            <View
              key={i}
              style={[styles.segment, i < filled ? styles.segmentLived : styles.segmentRemaining]}
            />
          ))}
        </View>
      </View>
      <View style={styles.cap} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
  },
  body: {
    width: BODY_W,
    height: BODY_H,
    borderWidth: BORDER,
    borderColor: SHELL_BORDER,
    borderRadius: BODY_RADIUS,
    backgroundColor: SHELL_FILL,
    padding: INNER_PAD,
    overflow: "hidden",
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    gap: SEG_GAP,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    borderRadius: 3,
  },
  segmentLived: {
    backgroundColor: LIVED,
  },
  segmentRemaining: {
    backgroundColor: REMAINING,
  },
  cap: {
    width: CAP_W,
    height: CAP_H,
    marginLeft: CAP_GAP,
    borderWidth: BORDER,
    borderLeftWidth: 0,
    borderColor: SHELL_BORDER,
    borderTopRightRadius: CAP_RADIUS,
    borderBottomRightRadius: CAP_RADIUS,
    backgroundColor: SHELL_FILL,
  },
});
