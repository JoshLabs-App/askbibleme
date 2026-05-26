import AsyncStorage from "@react-native-async-storage/async-storage";

const TELEMETRY_CONSENT_KEY = "askbible-telemetry-consent-v1";

export type TelemetryConsent = "unknown" | "granted" | "denied";

type Listener = () => void;

let telemetryConsent: TelemetryConsent = "unknown";
let hydrationStarted = false;
let hydrationPromise: Promise<TelemetryConsent> | null = null;
const listeners = new Set<Listener>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function normalizeConsent(raw: string | null): TelemetryConsent {
  if (raw === "granted" || raw === "denied") return raw;
  return "unknown";
}

export function getTelemetryConsent(): TelemetryConsent {
  return telemetryConsent;
}

export function isTelemetryConsentGranted(): boolean {
  return telemetryConsent === "granted";
}

export async function hydrateTelemetryConsent(): Promise<TelemetryConsent> {
  if (hydrationPromise) return hydrationPromise;
  hydrationStarted = true;
  hydrationPromise = (async () => {
    try {
      telemetryConsent = normalizeConsent(await AsyncStorage.getItem(TELEMETRY_CONSENT_KEY));
    } catch {
      telemetryConsent = "unknown";
    }
    notifyListeners();
    return telemetryConsent;
  })();
  return hydrationPromise;
}

export async function setTelemetryConsent(next: Exclude<TelemetryConsent, "unknown">): Promise<void> {
  telemetryConsent = next;
  hydrationStarted = true;
  await AsyncStorage.setItem(TELEMETRY_CONSENT_KEY, next);
  notifyListeners();
}

export function subscribeTelemetryConsent(listener: Listener): () => void {
  listeners.add(listener);
  if (!hydrationStarted) {
    void hydrateTelemetryConsent();
  }
  return () => {
    listeners.delete(listener);
  };
}
