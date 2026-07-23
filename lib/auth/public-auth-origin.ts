const PUBLIC_AUTH_HOSTNAMES = new Set([
  "askbible.me",
  "www.askbible.me",
  "legacy.askbible.me",
]);

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
