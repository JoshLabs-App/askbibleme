import { redirect } from "next/navigation";

/** Compatibility route aligned with mobile tabs index. */
export default function ShellIndexAliasPage() {
  redirect("/");
}

