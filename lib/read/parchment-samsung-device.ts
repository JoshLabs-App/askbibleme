/** Samsung Galaxy / Samsung Internet（含 S23 Ultra `SM-S918` 等） */
export function isSamsungGalaxyUa(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /SamsungBrowser/i.test(ua) ||
    /Samsung/i.test(ua) ||
    /\bSM-[A-Z]\d/i.test(ua)
  );
}
