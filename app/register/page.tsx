import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { RegisterClient } from "./RegisterClient";

export default function RegisterPage() {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  const registerOpen = flags.memberRegisterEnabled && Boolean(getAskbibleAuthSqlitePath());
  return <RegisterClient registerOpen={registerOpen} />;
}
