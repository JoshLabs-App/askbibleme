export type ScriptureBook = {
  bookNumber: number;
  bookId: string;
  bookName: string;
  chapters: number;
  overviewOnly?: boolean;
};

export const OLD_TESTAMENT_MAX_BOOK_NUMBER = 39;

export type ScriptureTestament = "old" | "new";

export function testamentForBookNumber(bookNumber: number): ScriptureTestament {
  return bookNumber <= OLD_TESTAMENT_MAX_BOOK_NUMBER ? "old" : "new";
}

export const scriptureBooks: ScriptureBook[] = [
  { bookNumber: 1, bookId: "GEN", bookName: "创世记", chapters: 50 },
  { bookNumber: 2, bookId: "EXO", bookName: "出埃及记", chapters: 40 },
  { bookNumber: 3, bookId: "LEV", bookName: "利未记", chapters: 27 },
  { bookNumber: 4, bookId: "NUM", bookName: "民数记", chapters: 36 },
  { bookNumber: 5, bookId: "DEU", bookName: "申命记", chapters: 34 },
  { bookNumber: 6, bookId: "JOS", bookName: "约书亚记", chapters: 24 },
  { bookNumber: 7, bookId: "JDG", bookName: "士师记", chapters: 21 },
  { bookNumber: 8, bookId: "RUT", bookName: "路得记", chapters: 4 },
  { bookNumber: 9, bookId: "1SA", bookName: "撒母耳记上", chapters: 31 },
  { bookNumber: 10, bookId: "2SA", bookName: "撒母耳记下", chapters: 24 },
  { bookNumber: 11, bookId: "1KI", bookName: "列王纪上", chapters: 22 },
  { bookNumber: 12, bookId: "2KI", bookName: "列王纪下", chapters: 25 },
  { bookNumber: 13, bookId: "1CH", bookName: "历代志上", chapters: 29 },
  { bookNumber: 14, bookId: "2CH", bookName: "历代志下", chapters: 36 },
  { bookNumber: 15, bookId: "EZR", bookName: "以斯拉记", chapters: 10 },
  { bookNumber: 16, bookId: "NEH", bookName: "尼希米记", chapters: 13 },
  { bookNumber: 17, bookId: "EST", bookName: "以斯帖记", chapters: 10 },
  { bookNumber: 18, bookId: "JOB", bookName: "约伯记", chapters: 42 },
  { bookNumber: 19, bookId: "PSA", bookName: "诗篇", chapters: 150 },
  { bookNumber: 20, bookId: "PRO", bookName: "箴言", chapters: 31 },
  { bookNumber: 21, bookId: "ECC", bookName: "传道书", chapters: 12 },
  { bookNumber: 22, bookId: "SNG", bookName: "雅歌", chapters: 8 },
  { bookNumber: 23, bookId: "ISA", bookName: "以赛亚书", chapters: 66 },
  { bookNumber: 24, bookId: "JER", bookName: "耶利米书", chapters: 52 },
  { bookNumber: 25, bookId: "LAM", bookName: "耶利米哀歌", chapters: 5 },
  { bookNumber: 26, bookId: "EZK", bookName: "以西结书", chapters: 48 },
  { bookNumber: 27, bookId: "DAN", bookName: "但以理书", chapters: 12 },
  { bookNumber: 28, bookId: "HOS", bookName: "何西阿书", chapters: 14 },
  { bookNumber: 29, bookId: "JOL", bookName: "约珥书", chapters: 3 },
  { bookNumber: 30, bookId: "AMO", bookName: "阿摩司书", chapters: 9 },
  { bookNumber: 31, bookId: "OBA", bookName: "俄巴底亚书", chapters: 1 },
  { bookNumber: 32, bookId: "JON", bookName: "约拿书", chapters: 4 },
  { bookNumber: 33, bookId: "MIC", bookName: "弥迦书", chapters: 7 },
  { bookNumber: 34, bookId: "NAM", bookName: "那鸿书", chapters: 3 },
  { bookNumber: 35, bookId: "HAB", bookName: "哈巴谷书", chapters: 3 },
  { bookNumber: 36, bookId: "ZEP", bookName: "西番雅书", chapters: 3 },
  { bookNumber: 37, bookId: "HAG", bookName: "哈该书", chapters: 2 },
  { bookNumber: 38, bookId: "ZEC", bookName: "撒迦利亚书", chapters: 14 },
  { bookNumber: 39, bookId: "MAL", bookName: "玛拉基书", chapters: 4 },
  { bookNumber: 40, bookId: "MAT", bookName: "马太福音", chapters: 28 },
  { bookNumber: 41, bookId: "MRK", bookName: "马可福音", chapters: 16 },
  { bookNumber: 42, bookId: "LUK", bookName: "路加福音", chapters: 24 },
  { bookNumber: 43, bookId: "JHN", bookName: "约翰福音", chapters: 21 },
  { bookNumber: 44, bookId: "ACT", bookName: "使徒行传", chapters: 28 },
  { bookNumber: 45, bookId: "ROM", bookName: "罗马书", chapters: 16 },
  { bookNumber: 46, bookId: "1CO", bookName: "哥林多前书", chapters: 16 },
  { bookNumber: 47, bookId: "2CO", bookName: "哥林多后书", chapters: 13 },
  { bookNumber: 48, bookId: "GAL", bookName: "加拉太书", chapters: 6 },
  { bookNumber: 49, bookId: "EPH", bookName: "以弗所书", chapters: 6 },
  { bookNumber: 50, bookId: "PHP", bookName: "腓立比书", chapters: 4 },
  { bookNumber: 51, bookId: "COL", bookName: "歌罗西书", chapters: 4 },
  { bookNumber: 52, bookId: "1TH", bookName: "帖撒罗尼迦前书", chapters: 5 },
  { bookNumber: 53, bookId: "2TH", bookName: "帖撒罗尼迦后书", chapters: 3 },
  { bookNumber: 54, bookId: "1TI", bookName: "提摩太前书", chapters: 6 },
  { bookNumber: 55, bookId: "2TI", bookName: "提摩太后书", chapters: 4 },
  { bookNumber: 56, bookId: "TIT", bookName: "提多书", chapters: 3 },
  { bookNumber: 57, bookId: "PHM", bookName: "腓利门书", chapters: 1 },
  { bookNumber: 58, bookId: "HEB", bookName: "希伯来书", chapters: 13 },
  { bookNumber: 59, bookId: "JAS", bookName: "雅各书", chapters: 5 },
  { bookNumber: 60, bookId: "1PE", bookName: "彼得前书", chapters: 5 },
  { bookNumber: 61, bookId: "2PE", bookName: "彼得后书", chapters: 3 },
  { bookNumber: 62, bookId: "1JN", bookName: "约翰一书", chapters: 5 },
  { bookNumber: 63, bookId: "2JN", bookName: "约翰二书", chapters: 1 },
  { bookNumber: 64, bookId: "3JN", bookName: "约翰三书", chapters: 1 },
  { bookNumber: 65, bookId: "JUD", bookName: "犹大书", chapters: 1 },
  { bookNumber: 66, bookId: "REV", bookName: "启示录", chapters: 22 }
];
