import type { ScriptureBookNote } from './scriptureBookNoteTypes';

import { scriptureBookNotesOtHistory } from './scriptureBookNotesOtHistory';
import { scriptureBookNotesOtPoetry } from './scriptureBookNotesOtPoetry';

export const scriptureBookNotesOt: ScriptureBookNote[] = [
  ...scriptureBookNotesOtHistory,
  ...scriptureBookNotesOtPoetry,
];
