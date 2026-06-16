import {
  completeGoogleOAuthFromCallbackUrl,
  type GoogleOAuthSessionResult,
} from "./googleOAuthSession";

const inflightByCode = new Map<string, Promise<GoogleOAuthSessionResult>>();

function oauthCodeFromUrl(url: string): string | null {
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const readSegment = (segment: string) => {
    for (const part of segment.split("&")) {
      if (!part) continue;
      const [rawKey, ...rest] = part.split("=");
      const key = decodeURIComponent(rawKey || "");
      if (key === "code") return decodeURIComponent(rest.join("=") || "").trim() || null;
    }
    return null;
  };
  if (queryIndex >= 0) {
    const end = hashIndex >= 0 ? hashIndex : url.length;
    const code = readSegment(url.slice(queryIndex + 1, end));
    if (code) return code;
  }
  if (hashIndex >= 0) {
    return readSegment(url.slice(hashIndex + 1));
  }
  return null;
}

/** One PKCE exchange per authorization code (deep link + browser flow may both await). */
export function exchangeOAuthCallbackOnce(url: string): Promise<GoogleOAuthSessionResult> {
  const code = oauthCodeFromUrl(url);
  if (code) {
    const existing = inflightByCode.get(code);
    if (existing) return existing;
    const promise = completeGoogleOAuthFromCallbackUrl(url).finally(() => {
      setTimeout(() => inflightByCode.delete(code), 60_000);
    });
    inflightByCode.set(code, promise);
    return promise;
  }
  return completeGoogleOAuthFromCallbackUrl(url);
}
