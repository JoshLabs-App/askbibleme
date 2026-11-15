import appBuildMeta from "@/lib/generated/app-build-meta.json";

/**
 * 与当前部署对应的构建标识：用于「新版本」对比。
 * - 优先构建期生成的 `lib/generated/app-build-meta.json`（与 `public/app-build.json` 同源，Workers 下无需 fs）
 * - Vercel：DEPLOYMENT_ID / GIT_COMMIT_SHA
 */
export function getAppBuildId(): string {
  const fromGenerated =
    appBuildMeta && typeof appBuildMeta === "object" && typeof appBuildMeta.id === "string"
      ? appBuildMeta.id.trim()
      : "";
  if (fromGenerated && fromGenerated !== "unknown") return fromGenerated;
  if (process.env.VERCEL_DEPLOYMENT_ID) return process.env.VERCEL_DEPLOYMENT_ID;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  return process.env.NODE_ENV === "development" ? "development" : "unknown";
}
