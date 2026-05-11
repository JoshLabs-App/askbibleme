import fs from "node:fs";
import path from "node:path";

/**
 * 与当前部署对应的构建标识：用于「新版本请刷新」对比。
 * - Vercel：优先 DEPLOYMENT_ID（每次部署唯一），其次 GIT_COMMIT_SHA
 * - 其它环境：读 `.next/BUILD_ID`（与本次 Node 进程服务的构建一致）
 */
export function getAppBuildId(): string {
  if (process.env.VERCEL_DEPLOYMENT_ID) return process.env.VERCEL_DEPLOYMENT_ID;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      return fs.readFileSync(buildIdPath, "utf8").trim();
    }
  } catch {
    /* ignore */
  }
  return process.env.NODE_ENV === "development" ? "development" : "unknown";
}
