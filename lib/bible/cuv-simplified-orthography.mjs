/**
 * 和合本简体源文件沿用了少量早期排印字、异体字及台湾用字。
 * 这里只做现代简体规范字形替换，不改句式、标点或经文含义。
 *
 * 较长的词组必须先于单字替换，以免误伤仍有现代用法的字（如“彷徨”）。
 */
export const CUV_SIMPLIFIED_ORTHOGRAPHY_REPLACEMENTS = Object.freeze([
  ["相彷", "相仿"],
  ["牠", "它"],
  ["藉", "借"],
  ["毘", "毗"],
  ["痲", "麻"],
  ["彀", "够"],
  ["窰", "窑"],
  ["儆", "警"],
  ["醡", "榨"],
  ["撚", "捻"],
  ["稭", "秸"],
  ["赒", "周"],
  ["繙", "翻"],
  ["櫺", "棂"],
  ["餂", "舔"],
  ["蹧", "糟"],
  ["讟", "渎"],
  ["摀", "捂"],
  ["餽", "馈"],
  ["籐", "藤"],
  ["菢", "抱"],
  ["儹", "攒"],
  ["鵀", "胜"],
  ["麅", "狍"],
  ["啣", "衔"],
  ["羢", "绒"],
  ["搥", "捶"],
  ["銲", "焊"],
  ["铇", "刨"],
  ["諠", "喧"],
  ["箒", "帚"],
  ["簷", "檐"],
  ["倣", "仿"],
  ["舖", "铺"],
  ["荳", "豆"],
]);

export function normalizeCuvSimplifiedOrthography(text) {
  let normalized = String(text ?? "");
  for (const [legacy, modern] of CUV_SIMPLIFIED_ORTHOGRAPHY_REPLACEMENTS) {
    normalized = normalized.replaceAll(legacy, modern);
  }
  return normalized;
}

export function findLegacyCuvSimplifiedOrthography(text) {
  const source = String(text ?? "");
  return CUV_SIMPLIFIED_ORTHOGRAPHY_REPLACEMENTS.flatMap(([legacy, modern]) => {
    const count = source.split(legacy).length - 1;
    return count > 0 ? [{ legacy, modern, count }] : [];
  });
}
