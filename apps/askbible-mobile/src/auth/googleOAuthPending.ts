type OAuthWaiter = {
  resolve: (url: string) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

let active: OAuthWaiter | null = null;

export function beginGoogleOAuthCallbackWait(timeoutMs = 120_000): Promise<string> {
  cancelGoogleOAuthCallbackWait();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (active) active = null;
      reject(new Error("google_oauth_timeout"));
    }, timeoutMs);
    active = {
      resolve: (url) => {
        clearTimeout(timer);
        resolve(url);
      },
      reject: (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
      timer,
    };
  });
}

export function deliverGoogleOAuthCallback(url: string): boolean {
  if (!active) return false;
  const waiter = active;
  active = null;
  clearTimeout(waiter.timer);
  waiter.resolve(url);
  return true;
}

export function cancelGoogleOAuthCallbackWait(): void {
  if (!active) return;
  clearTimeout(active.timer);
  active = null;
}

export function hasPendingGoogleOAuthCallback(): boolean {
  return active !== null;
}
