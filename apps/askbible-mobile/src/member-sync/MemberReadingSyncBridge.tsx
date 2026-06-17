import { View } from "react-native";
import { useMemberAuth } from "../auth/MemberAuthProvider";
import { MemberReadingSyncDebugOverlay } from "./MemberReadingSyncDebugOverlay";
import { useMemberReadingSync } from "./useMemberReadingSync";

export function MemberReadingSyncBridge() {
  const { bootstrapped, user } = useMemberAuth();
  const enabled = bootstrapped && Boolean(user);
  useMemberReadingSync(enabled);
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      {enabled ? <MemberReadingSyncDebugOverlay /> : null}
    </View>
  );
}
