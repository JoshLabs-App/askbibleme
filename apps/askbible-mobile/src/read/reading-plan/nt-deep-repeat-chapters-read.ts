/**
 * 新约深读：已读章的记录。**实现只有 `lib/bible/reading-plans/nt-deep-repeat-chapters-read.ts` 一份**。
 *
 * 手机曾另有一份逐字重写的拷贝。两份同形实现不会报错，只会各自往前走——
 * 同一族的 triple-loop 状态就这么分叉过：「读了几章」的计数在一端是数出来的、
 * 在另一端是存下来的，而这份状态正是两端互相同步的。
 */
export {
  addNtDeepRepeatChapterReadToState,
  normalizeNtDeepRepeatChaptersReadKeys,
  ntDeepRepeatChapterReadKey,
} from "@/lib/bible/reading-plans/nt-deep-repeat-chapters-read";
