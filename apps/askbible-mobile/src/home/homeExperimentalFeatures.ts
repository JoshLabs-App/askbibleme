import AsyncStorage from "@react-native-async-storage/async-storage";

const HOME_TTS_EXPERIMENT_KEY = "askbible-home-tts-experiment-v1";

type Listener = () => void;

const listeners = new Set<Listener>();
let hydrated = false;
let homeTtsExperimentEnabled = false;

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeHomeTtsExperiment(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHomeTtsExperimentEnabled(): boolean {
  return homeTtsExperimentEnabled;
}

export async function hydrateHomeTtsExperiment(): Promise<boolean> {
  if (hydrated) return homeTtsExperimentEnabled;
  try {
    homeTtsExperimentEnabled = (await AsyncStorage.getItem(HOME_TTS_EXPERIMENT_KEY)) === "1";
  } catch {
    homeTtsExperimentEnabled = false;
  }
  hydrated = true;
  emit();
  return homeTtsExperimentEnabled;
}

export async function setHomeTtsExperimentEnabled(next: boolean): Promise<void> {
  if (next === homeTtsExperimentEnabled && hydrated) return;
  homeTtsExperimentEnabled = next;
  hydrated = true;
  try {
    await AsyncStorage.setItem(HOME_TTS_EXPERIMENT_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}
