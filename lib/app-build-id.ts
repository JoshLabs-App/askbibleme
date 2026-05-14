import fs from "node:fs";
import path from "node:path";

function readAppBuildJsonId(): string | null {
  try {
    const p = path.join(process.cwd(), "public", "app-build.json");
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const id = (raw as { id?: unknown }).id;
    if (typeof id !== "string") return null;
    const t = id.trim();
    return t.length ? t : null;
  } catch {
    return null;
  }
}

/**
 * 与当前部署对应的构建标识：用于「新版本」对比。
 * - 优先 `public/app-build.json`（与静态资源/CDN 同源，利于纯静态托管）
 * - Vercel：DEPLOYMENT_ID / GIT_COMMIT_SHA
 * - 其它：`.next/BUILD_ID`
 */
export function getAppBuildId(): string {
  const fromFile = readAppBuildJsonId();
  if (fromFile) return fromFile;
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
