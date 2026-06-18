/** Heidelberg Catechism: 3 parts (guilt / grace / gratitude), 52 Lord's Days. */

/** @typedef {{ part: 1 | 2 | 3; startDay: number; endDay: number; titleZh: string; titleZhTw: string; titleEn: string }} HeidelbergPartSection */

/** @type {HeidelbergPartSection[]} */
export const HEIDELBERG_PARTS = [
  {
    part: 1,
    startDay: 2,
    endDay: 4,
    titleZh: "第一部：人的愁苦",
    titleZhTw: "第一部：人的愁苦",
    titleEn: "Part I: Man's Misery",
  },
  {
    part: 2,
    startDay: 5,
    endDay: 31,
    titleZh: "第二部：人的释救",
    titleZhTw: "第二部：人的釋救",
    titleEn: "Part II: Man's Deliverance",
  },
  {
    part: 3,
    startDay: 32,
    endDay: 52,
    titleZh: "第三部：人的感恩",
    titleZhTw: "第三部：人的感恩",
    titleEn: "Part III: Man's Gratitude",
  },
];

export const HEIDELBERG_LORDS_DAY_COUNT = 52;
export const HEIDELBERG_INTRO_LORD_DAY = 1;
