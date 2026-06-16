import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { isMemberRegisterSurfaceOpen } from "@/lib/member-auth-backend";
import { RegisterClient } from "./RegisterClient";

export default function RegisterPage() {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  const registerOpen = isMemberRegisterSurfaceOpen(flags);
  return <RegisterClient registerOpen={registerOpen} />;
}
