import appBuildMeta from "@/lib/generated/app-build-meta.json";

type BuildMetaShape = {
  id?: string;
  builtAt?: string;
};

/**
 * 与当前部署对应的构建标识：用于「新版本」对比。
 * - 优先构建期生成的 `lib/generated/app-build-meta.json`（与 `public/app-build.json` 同源，Workers 下无需 fs）
 */
export function getAppBuildId(): string {
  const meta = appBuildMeta as BuildMetaShape | null | undefined;
  const fromGenerated = meta && typeof meta.id === "string" ? meta.id.trim() : "";
  if (fromGenerated && fromGenerated !== "unknown") return fromGenerated;
  return process.env.NODE_ENV === "development" ? "development" : "unknown";
}

export function getAppBuiltAt(): string {
  const meta = appBuildMeta as BuildMetaShape | null | undefined;
  return meta && typeof meta.builtAt === "string" ? meta.builtAt.trim() : "";
}
