import { useMemberAuth } from "../auth/MemberAuthProvider";
import { useMemberReadingSync } from "./useMemberReadingSync";

export function MemberReadingSyncBridge() {
  const { bootstrapped, user } = useMemberAuth();
  useMemberReadingSync(bootstrapped && Boolean(user));
  return null;
}
