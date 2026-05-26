import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

const LINE_H = StyleSheet.hairlineWidth * 3;

function fadeLineColors(strong = false): readonly [string, string, string, string] {
  const mid = strong ? "rgba(28, 20, 16, 0.38)" : c.border;
  const m = mid.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  const clear = m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0)` : "transparent";
  return [clear, mid, mid, clear];
}

/** 横轴两端渐隐，与羊皮卷时间轴气质一致 */
export function ExploreTimelineFadeLine() {
  return (
    <LinearGradient
      colors={fadeLineColors(false)}
      locations={[0, 0.16, 0.84, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.line}
    />
  );
}

/** 出生至今日为实色段，今日之后渐隐（数算年日时间轴） */
export function ExploreTimelineProgressLine({ progress }: { progress: number }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.progressWrap}>
      <LinearGradient
        colors={fadeLineColors(false)}
        locations={[0, 0.16, 0.84, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.line}
      />
      <View style={[styles.progressFill, { width: `${p * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    width: "100%",
    height: LINE_H,
    position: "relative",
    justifyContent: "center",
  },
  line: {
    width: "100%",
    height: LINE_H,
    borderRadius: 1,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(28, 20, 16, 0.38)",
    borderRadius: 1,
  },
});
