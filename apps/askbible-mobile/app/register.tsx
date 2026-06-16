import { Redirect } from "expo-router";
import { MemberRegisterScreen } from "../src/auth/MemberRegisterScreen";
import { useMemberAuth } from "../src/auth/MemberAuthProvider";

export default function RegisterRoute() {
  const { user, bootstrapped } = useMemberAuth();
  if (bootstrapped && user) {
    return <Redirect href="/" />;
  }
  return <MemberRegisterScreen />;
}
