import { redirect } from "next/navigation";
import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

/** Compatibility route aligned with mobile tabs index. */
export default function ShellIndexAliasPage() {
  redirect(WEB_APP_HOME_PATH);
}

