import type { YearsDaysEternityDocument } from "./years-days-eternity-types";

export const YEARS_DAYS_ETERNITY_EN: YearsDaysEternityDocument = {
  pageTitle: "Years, Days, and Eternity",
  intro: [
    {
      type: "prose",
      lines: [
        "Global life expectancy is still brief.",
        "Our days pass quickly, but they are precious before God.",
      ],
    },
    {
      type: "scripture",
      lines: [
        "The days of our years are threescore years and ten;",
        "and if by reason of strength they be fourscore years...",
      ],
      ref: "Psalm 90:10",
    },
    { type: "divider" },
  ],
  sections: [
    {
      id: "creation",
      title: "1. Created by God, given breath",
      blocks: [
        { type: "scripture", lines: ["God created man in his own image."], ref: "Genesis 1:27" },
      ],
    },
    {
      id: "finite-days",
      title: "2. Our days are limited",
      blocks: [{ type: "scripture", lines: ["Teach us to number our days."], ref: "Psalm 90:12" }],
    },
    {
      id: "sin-death",
      title: "3. Sin, death, and judgment",
      blocks: [{ type: "scripture", lines: ["It is appointed unto men once to die."], ref: "Hebrews 9:27" }],
    },
    {
      id: "redemption",
      title: "4. God loves and redeems",
      blocks: [
        { type: "scripture", lines: ["For God so loved the world..."], ref: "John 3:16" },
      ],
    },
    {
      id: "repent-believe",
      title: "5. Repent and believe",
      blocks: [{ type: "scripture", lines: ["Repent ye, and believe the gospel."], ref: "Mark 1:15" }],
    },
    {
      id: "rebirth",
      title: "6. New birth and new life",
      blocks: [{ type: "scripture", lines: ["If any man be in Christ, he is a new creature."], ref: "2 Corinthians 5:17" }],
    },
    {
      id: "abide-faith",
      title: "7. Abide and endure in faith",
      blocks: [{ type: "scripture", lines: ["Abide in me, and I in you."], ref: "John 15:4" }],
    },
    {
      id: "eternal-hope",
      title: "8. Eternal life and hope",
      blocks: [{ type: "scripture", lines: ["I am the resurrection, and the life."], ref: "John 11:25" }],
    },
  ],
  closing: [
    {
      type: "prose",
      lines: [
        "Our days are short, but eternity is real.",
        "In Christ, death is not the end.",
      ],
    },
  ],
  finale: {
    leadLines: ["In Christ,", "death is not the end."],
    scripture: {
      type: "scripture",
      lines: ["I am the resurrection, and the life."],
      ref: "John 11:25",
    },
  },
};
