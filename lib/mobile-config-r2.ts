import { NextResponse } from "next/server";

/**
 * App 纯配置接口的 R2 承载地址。对象键与线上路由路径一一对应，
 * 内容由 `npm run mobile:config:push-r2` 镜像上去（见 scripts/build-mobile-config-r2.ts）。
 *
 * 与移动端共用同一个公开桶（`goldenVerseAudioRemote.ts`、`musicAudioRemote.ts`）。
 * 桶名与 pub-* id 已编译进上架二进制，不可更改——见 AGENTS.md 的 R2 铁律。
 */
export const MOBILE_CONFIG_R2_BASE =
  "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

/**
 * 生产环境把 GET 转到 R2；开发环境返回 null，交给路由自己读本地 `data/*.json`——
 * 否则本机改内容得先推一次 R2 才看得见。
 *
 * 纯 GET 的 6 个配置路由直接在 next.config.mjs 里重定向；这里只服务
 * `/api/nature/settings` 与 `/api/music/companion` —— 它们还带 POST（后台写盘），
 * 而 next.config 的 redirects 不区分方法，会把 POST 一并劫走。
 */
export function mobileConfigR2RedirectForGet(route: string): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  return NextResponse.redirect(`${MOBILE_CONFIG_R2_BASE}${route}`, 307);
}
