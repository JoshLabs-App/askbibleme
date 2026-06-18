import { useMemberAuth } from "../auth/MemberAuthProvider";
import { useMemberReadingSync } from "./useMemberReadingSync";

export function MemberReadingSyncBridge() {
  const { bootstrapped, user } = useMemberAuth();
  const enabled = bootstrapped && Boolean(user);
  useMemberReadingSync(enabled);
  return null;
}
