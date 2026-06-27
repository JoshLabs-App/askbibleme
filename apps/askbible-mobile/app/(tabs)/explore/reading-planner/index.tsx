import { StyleSheet, View } from "react-native";
import { ReadingPlannerScreen } from "../../../../src/explore/reading-planner/ReadingPlannerScreen";

export default function ReadingPlannerRoute() {
  return (
    <View style={styles.root}>
      <ReadingPlannerScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
