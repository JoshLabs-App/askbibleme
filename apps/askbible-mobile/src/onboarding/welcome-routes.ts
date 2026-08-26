export function welcomeHref(): "/welcome" {
  return "/welcome";
}

export function welcomeRoute(options?: { gate?: boolean }) {
  if (options?.gate) {
    return {
      pathname: "/welcome" as const,
      params: { gate: "1" },
    };
  }
  return {
    pathname: "/welcome" as const,
  };
}

export function isWelcomeRoute(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  // 根栈 /welcome；勿匹配已移除的 /explore/welcome。
  return p === "/welcome" || p === "welcome" || /^\/?\(tabs\)\/welcome$/.test(p);
}
