function envTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** 服务端 / 构建时：会员注册是否开放 */
export function isMemberRegisterEnabledFromEnv(): boolean {
  return (
    envTruthy(process.env.MEMBER_REGISTER_ENABLED) ||
    envTruthy(process.env.NEXT_PUBLIC_MEMBER_REGISTER_ENABLED)
  );
}

/** 浏览器端：注册入口是否展示（需 NEXT_PUBLIC_MEMBER_REGISTER_ENABLED=1） */
export function isMemberRegisterEnabledClient(): boolean {
  return envTruthy(process.env.NEXT_PUBLIC_MEMBER_REGISTER_ENABLED);
}
