import type { ShellChromeTune } from "../shell/chromeScrim";
import { readShellChromeTune, writeShellChromeTune } from "./natureHomeChromeTunePrefs";
import {
  readNatureHomeTtsPrefs,
  writeNatureHomeTtsPrefs,
  type NatureHomeTtsPrefs,
} from "./natureHomeTtsPrefs";
import {
  readNatureVisualLevels,
  writeNatureVisualLevels,
  type NatureVisualLevels,
} from "./natureHomeVisualPrefs";
import {
  readNatureHomeTextScaleIndex,
  readNatureHomeVerseAppearance,
  writeNatureHomeTextScaleIndex,
  writeNatureHomeVerseAppearance,
  type NatureHomeVerseAppearance,
} from "./natureHomeVerseAppearancePrefs";

export type NatureHomeUiSyncBundle = {
  version: 1;
  ttsPrefs: NatureHomeTtsPrefs;
  visualLevels: NatureVisualLevels;
  verseAppearance: NatureHomeVerseAppearance;
  textScaleIndex: number;
  chromeTune: ShellChromeTune;
};

export async function readNatureHomeUiSyncBundle(): Promise<NatureHomeUiSyncBundle> {
  const [ttsPrefs, visualLevels, verseAppearance, textScaleIndex, chromeTune] = await Promise.all([
    readNatureHomeTtsPrefs(),
    readNatureVisualLevels(),
    readNatureHomeVerseAppearance(),
    readNatureHomeTextScaleIndex(),
    readShellChromeTune(),
  ]);
  return { version: 1, ttsPrefs, visualLevels, verseAppearance, textScaleIndex, chromeTune };
}

export async function applyNatureHomeUiSyncBundle(bundle: NatureHomeUiSyncBundle): Promise<void> {
  if (bundle.version !== 1) return;
  await Promise.all([
    writeNatureHomeTtsPrefs(bundle.ttsPrefs),
    writeNatureVisualLevels(bundle.visualLevels),
    writeNatureHomeVerseAppearance(bundle.verseAppearance),
    writeNatureHomeTextScaleIndex(bundle.textScaleIndex),
    writeShellChromeTune(bundle.chromeTune),
  ]);
}
