import { readNatureHomeTtsPrefs, writeNatureHomeTtsPrefs, type NatureHomeTtsPrefs } from "@/lib/home/nature-home-tts-prefs";
import {
  readNatureHomeTextScaleStepIndex,
  writeNatureHomeTextScaleStepIndex,
} from "@/lib/home/nature-home-text-scale-prefs";
import {
  readNatureHomeVerseAppearance,
  writeNatureHomeVerseAppearance,
  type NatureHomeVerseAppearanceV1,
} from "@/lib/home/nature-home-verse-appearance-prefs";
import {
  readNatureVisualLevels,
  writeNatureVisualLevels,
  type NatureVisualLevels,
} from "@/lib/nature/nature-visual-level-prefs";
import {
  readShellTemplateChromeTuneFromStorage,
  writeShellTemplateChromeTuneToStorage,
} from "@/lib/shell/shell-template-chrome-tune-storage";
import type { ShellTemplateChromeTune } from "@/lib/shell/template-preview-themes";

export type NatureHomeUiSyncBundle = {
  version: 1;
  ttsPrefs: NatureHomeTtsPrefs;
  visualLevels: NatureVisualLevels;
  verseAppearance: NatureHomeVerseAppearanceV1;
  textScaleIndex: number;
  chromeTune: ShellTemplateChromeTune;
};

export function readNatureHomeUiSyncBundle(): NatureHomeUiSyncBundle {
  return {
    version: 1,
    ttsPrefs: readNatureHomeTtsPrefs(),
    visualLevels: readNatureVisualLevels(),
    verseAppearance: readNatureHomeVerseAppearance(),
    textScaleIndex: readNatureHomeTextScaleStepIndex(),
    chromeTune: readShellTemplateChromeTuneFromStorage(),
  };
}

export function applyNatureHomeUiSyncBundle(bundle: NatureHomeUiSyncBundle): void {
  if (bundle.version !== 1 || typeof window === "undefined") return;
  writeNatureHomeTtsPrefs(bundle.ttsPrefs);
  writeNatureVisualLevels(bundle.visualLevels);
  writeNatureHomeVerseAppearance(bundle.verseAppearance);
  writeNatureHomeTextScaleStepIndex(bundle.textScaleIndex);
  writeShellTemplateChromeTuneToStorage(bundle.chromeTune);
}
