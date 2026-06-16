import { AppState, Linking, Platform } from "react-native";
import { deliverGoogleOAuthCallback } from "./googleOAuthPending";
import { isGoogleOAuthCallbackUrl } from "./googleOAuthSession";

let installed = false;

function deliverOAuthUrl(url: string): void {
  if (!isGoogleOAuthCallbackUrl(url)) return;
  deliverGoogleOAuthCallback(url);
}

function pollInitialOAuthUrl(): void {
  void Linking.getInitialURL().then((url) => {
    if (url) deliverOAuthUrl(url);
  });
}

/** Capture OAuth callbacks as early as possible (before React mount / after App resume). */
export function installGoogleOAuthLinkingCapture(): void {
  if (installed) return;
  installed = true;

  Linking.addEventListener("url", ({ url }) => deliverOAuthUrl(url));

  if (Platform.OS === "android") {
    AppState.addEventListener("change", (state) => {
      if (state === "active") pollInitialOAuthUrl();
    });
  }
}
