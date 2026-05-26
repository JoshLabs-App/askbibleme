import { t } from "../i18n/site-copy";

const DEFAULT_TIMEOUT_MS = 12_000;

export async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchInit, signal: controller.signal });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (!contentType.includes("application/json")) {
      throw new Error(t("mobile.fetchNotJson"));
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(t("mobile.fetchTimeout"));
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
