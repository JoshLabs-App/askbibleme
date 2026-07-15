export const KJV_CHAPTER_AUDIO_REMOTE_BASE =
  "https://www.audiotreasure.com/content/KJV_AT";

const BOOK_NAME_EN: Record<string, string> = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers", DEU: "Deuteronomy",
  JOS: "Joshua", JDG: "Judges", RUT: "Ruth", "1SA": "1Samuel", "2SA": "2Samuel",
  "1KI": "1Kings", "2KI": "2Kings", "1CH": "1Chronicles", "2CH": "2Chronicles",
  EZR: "Ezra", NEH: "Nehemiah", EST: "Esther", JOB: "Job", PSA: "Psalms",
  PRO: "Proverbs", ECC: "Ecclesiastes", SNG: "SongofSolomon", ISA: "Isaiah",
  JER: "Jeremiah", LAM: "Lamentations", EZK: "Ezekiel", DAN: "Daniel", HOS: "Hosea",
  JOL: "Joel", AMO: "Amos", OBA: "Obadiah", JON: "Jonah", MIC: "Micah", NAM: "Nahum",
  HAB: "Habakkuk", ZEP: "Zephaniah", HAG: "Haggai", ZEC: "Zechariah", MAL: "Malachi",
  MAT: "Matthew", MRK: "Mark", LUK: "Luke", JHN: "John", ACT: "Acts", ROM: "Romans",
  "1CO": "1Corinthians", "2CO": "2Corinthians", GAL: "Galatians", EPH: "Ephesians",
  PHP: "Philippians", COL: "Colossians", "1TH": "1Thessalonians", "2TH": "2Thessalonians",
  "1TI": "1Timothy", "2TI": "2Timothy", TIT: "Titus", PHM: "Philemon", HEB: "Hebrews",
  JAS: "James", "1PE": "1Peter", "2PE": "2Peter", "1JN": "1John", "2JN": "2John",
  "3JN": "3John", JUD: "Jude", REV: "Revelation",
};

const BOOK_NUMBER: Record<string, number> = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8,
  "1SA": 9, "2SA": 10, "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14,
  EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19, PRO: 20, ECC: 21, SNG: 22,
  ISA: 23, JER: 24, LAM: 25, EZK: 26, DAN: 27, HOS: 28, JOL: 29, AMO: 30,
  OBA: 31, JON: 32, MIC: 33, NAM: 34, HAB: 35, ZEP: 36, HAG: 37, ZEC: 38, MAL: 39,
  MAT: 40, MRK: 41, LUK: 42, JHN: 43, ACT: 44, ROM: 45, "1CO": 46, "2CO": 47,
  GAL: 48, EPH: 49, PHP: 50, COL: 51, "1TH": 52, "2TH": 53, "1TI": 54, "2TI": 55,
  TIT: 56, PHM: 57, HEB: 58, JAS: 59, "1PE": 60, "2PE": 61, "1JN": 62, "2JN": 63,
  "3JN": 64, JUD: 65, REV: 66,
};

export function buildAudioTreasureKjvChapterUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  const ordinal = BOOK_NUMBER[id];
  if (!ordinal || !Number.isInteger(chapter) || chapter < 1) return "";
  if (chapter === 1 && ["PHM", "2JN", "3JN", "JUD"].includes(id)) {
    return `${KJV_CHAPTER_AUDIO_REMOTE_BASE}/${String(ordinal).padStart(2, "0")}_${BOOK_NAME_EN[id]}.mp3`;
  }
  const stem =
    id === "JOB"
      ? "18_Job"
      : id === "SNG"
        ? "22_Song_of_Soloman"
        : `${String(ordinal).padStart(2, "0")}_${BOOK_NAME_EN[id] ?? id}`;
  return `${KJV_CHAPTER_AUDIO_REMOTE_BASE}/${stem}${String(chapter).padStart(3, "0")}.mp3`;
}
