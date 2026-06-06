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

export function hydrateHomeTtsExperiment(): void {
  getHomeTtsExperimentEnabled();
}

export function getHomeTtsExperimentEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!hydrated) {
    try {
      homeTtsExperimentEnabled = window.localStorage.getItem(HOME_TTS_EXPERIMENT_KEY) === "1";
    } catch {
      homeTtsExperimentEnabled = false;
    }
    hydrated = true;
  }
  return homeTtsExperimentEnabled;
}

export function setHomeTtsExperimentEnabled(next: boolean): void {
  if (typeof window === "undefined") return;
  if (next === homeTtsExperimentEnabled && hydrated) return;
  homeTtsExperimentEnabled = next;
  hydrated = true;
  try {
    window.localStorage.setItem(HOME_TTS_EXPERIMENT_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}
