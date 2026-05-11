import { permanentRedirect } from "next/navigation";

/** 旧地址 /nature 已并入首页 `/` */
export default function NatureLegacyPage() {
  permanentRedirect("/");
}
