import { Redirect } from "expo-router";
import { MemberLoginScreen } from "../src/auth/MemberLoginScreen";
import { useMemberAuth } from "../src/auth/MemberAuthProvider";

export default function LoginRoute() {
  const { user, bootstrapped } = useMemberAuth();
  if (bootstrapped && user) {
    return <Redirect href="/" />;
  }
  return <MemberLoginScreen />;
}
