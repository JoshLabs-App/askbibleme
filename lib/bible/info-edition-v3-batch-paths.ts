import path from "node:path";

const BATCH_STATE_FILENAME = "info-edition-v3-batch-state.json";
const BATCH_LOCK_FILENAME = "info-edition-v3-batch.lock";
const BATCH_LOG_FILENAME = "info-edition-v3-batch.log";
const BATCH_UI_CONFIG_FILENAME = "info-edition-v3-batch-ui.json";

export function infoEditionV3BatchArtifactsDir(cwd: string): string {
  return path.join(cwd, "data", "bible");
}

export function infoEditionV3BatchStatePath(cwd: string): string {
  return path.join(infoEditionV3BatchArtifactsDir(cwd), BATCH_STATE_FILENAME);
}

export function infoEditionV3BatchLockPath(cwd: string): string {
  return path.join(infoEditionV3BatchArtifactsDir(cwd), BATCH_LOCK_FILENAME);
}

export function infoEditionV3BatchLogPath(cwd: string): string {
  return path.join(infoEditionV3BatchArtifactsDir(cwd), BATCH_LOG_FILENAME);
}

export function infoEditionV3BatchUiConfigPath(cwd: string): string {
  return path.join(infoEditionV3BatchArtifactsDir(cwd), BATCH_UI_CONFIG_FILENAME);
}
