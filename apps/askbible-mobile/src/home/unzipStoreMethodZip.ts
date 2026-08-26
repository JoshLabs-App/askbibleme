import { Directory, File } from "expo-file-system";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIR_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIR = 0x06054b50;

/** 后台整包解压时每写多少个文件让出一次 JS 线程，避免卡住开播。 */
const UNZIP_YIELD_EVERY = 24;

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 从 store-only zip 抽出单个条目（跳过其它条目数据，避免整包读入 JS 内存）。 */
export function extractStoreMethodZipEntry(
  zipFile: File,
  entryPath: string,
): Uint8Array | null {
  if (!zipFile.exists) {
    throw new Error("zip missing");
  }
  const wanted = entryPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!wanted || wanted.includes("..")) {
    throw new Error(`unsafe zip path: ${entryPath}`);
  }

  const handle = zipFile.open();
  try {
    const size = handle.size ?? zipFile.size;
    while ((handle.offset ?? 0) + 4 <= size) {
      const sigBytes = handle.readBytes(4);
      if (sigBytes.length < 4) break;
      const sig = readU32(sigBytes, 0);
      if (sig === CENTRAL_DIR_HEADER || sig === END_OF_CENTRAL_DIR) break;
      if (sig !== LOCAL_FILE_HEADER) {
        throw new Error(`unsupported zip signature ${sig.toString(16)}`);
      }

      const fixed = handle.readBytes(26);
      if (fixed.length < 26) throw new Error("truncated zip header");
      const flags = readU16(fixed, 2);
      const method = readU16(fixed, 4);
      const compSize = readU32(fixed, 14);
      const nameLen = readU16(fixed, 22);
      const extraLen = readU16(fixed, 24);

      if (flags & 0x8) {
        throw new Error("zip data descriptor not supported");
      }
      if (method !== 0) {
        throw new Error(`zip method ${method} not supported (need store/0)`);
      }

      const nameBytes = handle.readBytes(nameLen);
      const name = decodeUtf8(nameBytes).replace(/\\/g, "/");
      if (extraLen > 0) handle.readBytes(extraLen);

      if (name === wanted) {
        return compSize > 0 ? handle.readBytes(compSize) : new Uint8Array(0);
      }

      // 跳过未命中条目，勿 readBytes 整段进 JS。
      const next = (handle.offset ?? 0) + compSize;
      handle.offset = next;
    }
  } finally {
    handle.close();
  }
  return null;
}

/**
 * 解压「仅 STORE（method=0）」的 zip。同步脚本用 `zip -0` 打包，保证字节原样。
 * 异步版会定期让出事件循环，便于边播边解。
 */
export async function unzipStoreMethodZipAsync(
  zipFile: File,
  destRoot: Directory,
): Promise<number> {
  if (!zipFile.exists) {
    throw new Error("zip missing");
  }
  if (!destRoot.exists) {
    destRoot.create({ intermediates: true, idempotent: true });
  }

  const handle = zipFile.open();
  let extracted = 0;
  try {
    const size = handle.size ?? zipFile.size;
    while ((handle.offset ?? 0) + 4 <= size) {
      const sigBytes = handle.readBytes(4);
      if (sigBytes.length < 4) break;
      const sig = readU32(sigBytes, 0);
      if (sig === CENTRAL_DIR_HEADER || sig === END_OF_CENTRAL_DIR) break;
      if (sig !== LOCAL_FILE_HEADER) {
        throw new Error(`unsupported zip signature ${sig.toString(16)}`);
      }

      const fixed = handle.readBytes(26);
      if (fixed.length < 26) throw new Error("truncated zip header");
      const flags = readU16(fixed, 2);
      const method = readU16(fixed, 4);
      const compSize = readU32(fixed, 14);
      const nameLen = readU16(fixed, 22);
      const extraLen = readU16(fixed, 24);

      if (flags & 0x8) {
        throw new Error("zip data descriptor not supported");
      }
      if (method !== 0) {
        throw new Error(`zip method ${method} not supported (need store/0)`);
      }

      const nameBytes = handle.readBytes(nameLen);
      const name = decodeUtf8(nameBytes).replace(/\\/g, "/");
      if (extraLen > 0) handle.readBytes(extraLen);

      const data = compSize > 0 ? handle.readBytes(compSize) : new Uint8Array(0);
      if (name.endsWith("/") || name.length === 0) continue;
      if (name.includes("..")) {
        throw new Error(`unsafe zip path: ${name}`);
      }

      const parts = name.split("/").filter(Boolean);
      if (parts.length === 0) continue;

      const out = new File(destRoot, ...parts);
      if (out.exists) out.delete();
      out.create({ intermediates: true, overwrite: true });
      out.write(data);
      extracted += 1;
      if (extracted % UNZIP_YIELD_EVERY === 0) {
        await yieldToEventLoop();
      }
    }
  } finally {
    handle.close();
  }
  return extracted;
}
