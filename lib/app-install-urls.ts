/** 默认 App Store 公开页（可被 env 覆盖）。ascAppId: 6771996188 */
export const DEFAULT_APP_INSTALL_IOS_URL =
  "https://apps.apple.com/app/id6771996188" as const;

/** Android 试用申请收件邮箱（可被 env 覆盖）。 */
export const DEFAULT_APP_INSTALL_ANDROID_EMAIL = "support@askbible.me" as const;

export const APP_INSTALL_IOS_URL =
  process.env.NEXT_PUBLIC_APP_INSTALL_IOS_URL?.trim() || DEFAULT_APP_INSTALL_IOS_URL;

export function resolveAppInstallAndroidEmail(): string {
  return (
    process.env.NEXT_PUBLIC_APP_INSTALL_ANDROID_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() ||
    DEFAULT_APP_INSTALL_ANDROID_EMAIL
  );
}

export function buildAndroidTrialMailto(subject: string, body: string): string {
  const email = resolveAppInstallAndroidEmail();
  const params = new URLSearchParams();
  if (subject.trim()) params.set("subject", subject.trim());
  if (body.trim()) params.set("body", body.trim());
  const query = params.toString();
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}
