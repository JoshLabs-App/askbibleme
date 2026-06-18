export type CreedReadLinkSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };
