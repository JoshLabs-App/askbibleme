import path from "node:path";
import { isInfoEditionOnlineBatchEnabled } from "@/lib/bible/info-edition-batch-access";
import {
  infoEditionExternalDataRoot,
  isInfoEditionWritableDiskAvailable,
} from "@/lib/bible/info-edition-published-path";

const BATCH_STATE_FILENAME = "info-edition-v1-batch-state.json";
const BATCH_LOCK_FILENAME = "info-edition-v1-batch.lock";
const BATCH_LOG_FILENAME = "info-edition-v1-batch.log";
const BATCH_UI_CONFIG_FILENAME = "info-edition-v1-batch-ui.json";

/** 批量进度、锁、日志目录：线上批量时用 DATA_ROOT，否则本机 data/bible */
export function infoEditionBatchArtifactsDir(cwd: string): string {
  const root = infoEditionExternalDataRoot();
  if (
    root &&
    isInfoEditionOnlineBatchEnabled() &&
    isInfoEditionWritableDiskAvailable(cwd)
  ) {
    return root;
  }
  return path.join(cwd, "data", "bible");
}

export function infoEditionBatchStatePath(cwd: string): string {
  return path.join(infoEditionBatchArtifactsDir(cwd), BATCH_STATE_FILENAME);
}

export function infoEditionBatchLockPath(cwd: string): string {
  return path.join(infoEditionBatchArtifactsDir(cwd), BATCH_LOCK_FILENAME);
}

export function infoEditionBatchLogPath(cwd: string): string {
  return path.join(infoEditionBatchArtifactsDir(cwd), BATCH_LOG_FILENAME);
}

export function infoEditionBatchUiConfigPath(cwd: string): string {
  return path.join(infoEditionBatchArtifactsDir(cwd), BATCH_UI_CONFIG_FILENAME);
}
