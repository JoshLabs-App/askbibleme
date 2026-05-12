/**
 * 将自然影片 URL 完整拉取到内存（用于「整段就绪后再切主画面」）。
 * `onProgress`：`totalBytes` 为 null 时表示无 Content-Length，仅报告已收字节数。
 */
export async function fetchNatureVideoFully(
  url: string,
  signal: AbortSignal,
  onProgress: (received: number, totalBytes: number | null) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  const lenHeader = res.headers.get("content-length");
  const totalParsed = lenHeader ? Number.parseInt(lenHeader, 10) : NaN;
  const totalBytes = Number.isFinite(totalParsed) && totalParsed > 0 ? totalParsed : null;

  const body = res.body;
  if (!body) {
    const buf = await res.arrayBuffer();
    onProgress(buf.byteLength, buf.byteLength);
    return buf;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress(received, totalBytes);
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}
