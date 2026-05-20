import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  infoEditionExternalDataRoot,
  infoEditionWritableBibleDir,
  isInfoEditionDiskSaveEnabled,
  isInfoEditionWritableDiskAvailable,
} from "@/lib/bible/info-edition-published-path";
import { isSupabaseServiceConfigured } from "@/lib/supabase/service";

const TELEMETRY_STORE_FILENAME = "telemetry-v1-store.json";

/** 与信息版同一套磁盘策略：dev → data/bible；Render → DATA_ROOT */
export function isTelemetryDiskSaveEnabled(): boolean {
  return isInfoEditionDiskSaveEnabled();
}

export function telemetryWritableDir(cwd = process.cwd()): string | null {
  return infoEditionWritableBibleDir(cwd);
}

export function isTelemetryWritableDiskAvailable(cwd = process.cwd()): boolean {
  if (!isTelemetryDiskSaveEnabled()) return false;
  return isInfoEditionWritableDiskAvailable(cwd);
}

export function telemetryStoreFilePath(cwd = process.cwd()): string | null {
  const dir = telemetryWritableDir(cwd);
  if (!dir) return null;
  return path.join(dir, TELEMETRY_STORE_FILENAME);
}

export function telemetryStorageMode(cwd = process.cwd()): "disk" | "supabase" | "none" {
  if (isTelemetryWritableDiskAvailable(cwd)) return "disk";
  if (isSupabaseServiceConfigured()) return "supabase";
  return "none";
}

export function telemetryStorageLabel(cwd = process.cwd()): string {
  const mode = telemetryStorageMode(cwd);
  if (mode === "disk") {
    const root = infoEditionExternalDataRoot() ?? path.join(cwd, "data", "bible");
    return `磁盘（${root}/${TELEMETRY_STORE_FILENAME}）`;
  }
  if (mode === "supabase") return "Supabase";
  return "未配置";
}

export function ensureTelemetryStoreDir(cwd = process.cwd()): string | null {
  const file = telemetryStoreFilePath(cwd);
  if (!file) return null;
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    if (process.env.NODE_ENV === "production" && !infoEditionExternalDataRoot()) {
      return null;
    }
    fs.mkdirSync(dir, { recursive: true });
  }
  return file;
}
