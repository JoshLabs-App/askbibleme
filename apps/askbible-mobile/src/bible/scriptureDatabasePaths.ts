/**
 * 与主仓库 `askbible-scripture-sqlite-v3`（含 theme_repeat_count）对齐；升级后须递增。
 * v5: 强制刷新设备侧已安装 sqlite，确保经文源文本修订（如个别汉字显示异常修复）能落地。
 * v6: 强制刷新说话标注修订（四福音神言/人话纠偏）。
 * v7: Android 内置 sqlite 复制校验 + 可读性探针，修复简体/繁体「无法读取本章」。
 * v8: Android 改回 legacy copyAsync（避免 File.bytes 整文件读入内存卡住），探针加超时。
 * v9: 改用 expo-sqlite importDatabaseFromAssetAsync + useNewConnection，修 Android prepareAsync NPE。
 */
export const SCRIPTURE_SQLITE_SCHEMA_VERSION = 9;

export function dbFileName(translationId: string): string {
  const normalized = translationId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${normalized}.sqlite`;
}

export function schemaVersionPath(dest: string): string {
  return `${dest}.schema-version`;
}

export function remoteBytesMarkerPath(dest: string): string {
  return `${dest}.remote-bytes`;
}
