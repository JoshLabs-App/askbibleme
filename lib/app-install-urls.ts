/** 默认 App Store 公开页（可被 env 覆盖）。ascAppId: 6771996188 */
export const DEFAULT_APP_INSTALL_IOS_URL =
  "https://apps.apple.com/app/id6771996188" as const;

/** 默认 Google Play 公开页（可被 env 覆盖）。package: me.askbible */
export const DEFAULT_APP_INSTALL_ANDROID_URL =
  "https://play.google.com/store/apps/details?id=me.askbible" as const;

/** 默认 Android 安装包（APK）直链（可被 env 覆盖），托管在 Cloudflare R2。 */
export const DEFAULT_APP_INSTALL_ANDROID_APK_URL =
  "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/downloads/android/AskBible-latest.apk" as const;

/** Android 试用申请收件邮箱（可被 env 覆盖）。 */
export const DEFAULT_APP_INSTALL_ANDROID_EMAIL = "support@askbible.me" as const;

export const APP_INSTALL_IOS_URL =
  process.env.NEXT_PUBLIC_APP_INSTALL_IOS_URL?.trim() || DEFAULT_APP_INSTALL_IOS_URL;

export const APP_INSTALL_ANDROID_URL =
  process.env.NEXT_PUBLIC_APP_INSTALL_ANDROID_URL?.trim() || DEFAULT_APP_INSTALL_ANDROID_URL;

export const APP_INSTALL_ANDROID_APK_URL =
  process.env.NEXT_PUBLIC_APP_INSTALL_ANDROID_APK_URL?.trim() ||
  DEFAULT_APP_INSTALL_ANDROID_APK_URL;

export function resolveAppInstallAndroidEmail(): string {
  return (
    process.env.NEXT_PUBLIC_APP_INSTALL_ANDROID_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() ||
    DEFAULT_APP_INSTALL_ANDROID_EMAIL
  );
}
