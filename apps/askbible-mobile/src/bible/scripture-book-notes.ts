export type { ScriptureBookNote, ScriptureBookSpiritualFrame } from "./scriptureBookNoteTypes";
import { scriptureBookNotesNt } from "./scriptureBookNotesNt";
import { scriptureBookNotesOt } from "./scriptureBookNotesOt";
import type { ScriptureBookNote } from "./scriptureBookNoteTypes";

export const scriptureBookNotes: ScriptureBookNote[] = [
  ...scriptureBookNotesOt,
  ...scriptureBookNotesNt,
];
