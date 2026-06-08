/** 默认 iOS TestFlight 公开邀请（可被 env 覆盖）。 */
export const DEFAULT_APP_INSTALL_IOS_URL =
  "https://testflight.apple.com/join/sPVRr9Td" as const;

/** 默认 Android Play 内部测试邀请（可被 env 覆盖）。 */
export const DEFAULT_APP_INSTALL_ANDROID_URL =
  "https://play.google.com/apps/testing/me.askbible" as const;

export const APP_INSTALL_IOS_URL =
  process.env.NEXT_PUBLIC_APP_INSTALL_IOS_URL?.trim() || DEFAULT_APP_INSTALL_IOS_URL;

export const APP_INSTALL_ANDROID_URL =
  process.env.NEXT_PUBLIC_APP_INSTALL_ANDROID_URL?.trim() || DEFAULT_APP_INSTALL_ANDROID_URL;
