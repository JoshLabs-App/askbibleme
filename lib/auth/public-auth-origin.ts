/**
 * 网页备用入口（防封换线，docs/anti-block-endpoints.md、DECISIONS D-20）：`askbible.me` 打不开时用户手输的第二个地址。
 * 同一个 Vercel 项目，内容完全一样；两个入口的登录状态不互通（cookie 按域名存）。
 */
export const BACKUP_ENTRY_HOSTNAMES: readonly string[] = ["askbible.joshlabs.app"];

const PUBLIC_AUTH_HOSTNAMES = new Set([
  "askbible.me",
  "www.askbible.me",
  "legacy.askbible.me",
  ...BACKUP_ENTRY_HOSTNAMES,
]);

/** 请求是不是打在备用入口上（`host` 头，可能带端口） */
export function isBackupEntryHost(host: string | null | undefined): boolean {
  const name = (host ?? "").split(":")[0].trim().toLowerCase();
  return BACKUP_ENTRY_HOSTNAMES.includes(name);
}

const LOCAL_AUTH_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const PRODUCTION_AUTH_ORIGIN = "https://askbible.me";

function firstForwardedValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function trustedPublicOrigin(host: string | null): string | null {
  if (!host) return null;

  try {
    const candidate = new URL(`https://${host}`);
    if (
      candidate.username ||
      candidate.password ||
      candidate.pathname !== "/" ||
      candidate.search ||
      candidate.hash ||
      !PUBLIC_AUTH_HOSTNAMES.has(candidate.hostname.toLowerCase())
    ) {
      return null;
    }
    return candidate.origin;
  } catch {
    return null;
  }
}

export function resolvePublicAuthOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedOrigin = trustedPublicOrigin(
    firstForwardedValue(request.headers.get("x-forwarded-host")),
  );
  if (forwardedOrigin) return forwardedOrigin;

  const requestOrigin = trustedPublicOrigin(requestUrl.host);
  if (requestOrigin) return requestOrigin;

  if (LOCAL_AUTH_HOSTNAMES.has(requestUrl.hostname.toLowerCase())) {
    return requestUrl.origin;
  }

  return PRODUCTION_AUTH_ORIGIN;
}
