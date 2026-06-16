import { getGoogleWebClientId, isGoogleSignInConfigured } from "../config/googleAuth";
import { isNativeGoogleSignInReady } from "./googleNativeAuthReady";
import { isSupabaseAuthConfigured } from "../config/supabaseAuth";

/** 仅当原生或 Supabase 浏览器 OAuth 任一可用时展示 Google 按钮。 */
export function isGoogleSignInAvailable(): boolean {
  if (isNativeGoogleSignInReady()) return true;
  return isSupabaseAuthConfigured() && Boolean(getGoogleWebClientId() || isGoogleSignInConfigured());
}
