/** 英文界面显示名：canonical englishName 优先，避免 en.displayName 仍是中文音译。 */
export function containsHanText(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function resolveLegacyFigureEnglishDisplayName(
  englishName: string | undefined,
  enDisplayName: string | undefined,
  displayNameZh: string,
): string {
  const canonical = englishName?.trim();
  if (canonical && !containsHanText(canonical)) return canonical;
  const fromEnBlock = enDisplayName?.trim();
  if (fromEnBlock && !containsHanText(fromEnBlock)) return fromEnBlock;
  if (canonical) return canonical;
  if (fromEnBlock) return fromEnBlock;
  return displayNameZh;
}

const CHARACTER_ROLE_EN: Record<string, string> = {
  主人物: "Primary character",
  相关人物: "Related figure",
};

export function legacyFigureCharacterRoleEn(text: string | undefined): string | undefined {
  if (!text) return text;
  return CHARACTER_ROLE_EN[text] ?? text;
}
