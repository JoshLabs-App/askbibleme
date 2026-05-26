export type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number;
};

/** 避免开发机未开 Next 时 fetch 一直挂起 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: FetchWithTimeoutInit,
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 12_000;
  const { timeoutMs: _timeout, ...rest } = init ?? {};
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
