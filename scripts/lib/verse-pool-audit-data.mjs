/**
 * Shared audit categories for theme-repeat-ge5 allowlist review.
 */
export const CATEGORY_META = {
  A_imprecatory: { label: "A · 暴力 / 咒诅 / 死刑", severity: "high", defaultKeep: false },
  B_gender_slavery: { label: "B · 性别 / 主仆权柄", severity: "high", defaultKeep: false },
  C_sexuality: { label: "C · 性伦理 / 情诗", severity: "high", defaultKeep: false },
  D_judgment: { label: "D · 审判 / 地狱", severity: "medium", defaultKeep: true },
  E_hyperbole: { label: "E · 夸张修辞", severity: "medium", defaultKeep: true },
  F_misquoted: { label: "F · 著名断章金句", severity: "low", defaultKeep: true },
  G_parable_voice: { label: "G · 比喻角色台词", severity: "medium", defaultKeep: false },
  H_open_list: { label: "H · 列举未完（顿号截断）", severity: "high", defaultKeep: false },
  I_short_fragment: { label: "I · 极短片段", severity: "medium", defaultKeep: true },
  J_split_pairs: { label: "J · 高流量上下节拆开", severity: "medium", defaultKeep: true },
};

export const KNOWN = {
  A_imprecatory: [
    "PSA.137.9", "EXO.22.24", "MAT.15.4", "LEV.20.10", "LEV.20.13", "PRO.7.22",
    "DEU.22.22", "EXO.21.17",
  ],
  B_gender_slavery: [
    "1PE.3.1", "COL.3.18", "EPH.5.22", "TIT.2.5", "1CO.11.3", "COL.3.22",
    "1PE.3.5", "EPH.5.24", "PRO.31.15",
  ],
  C_sexuality: [
    "1CO.6.9", "1CO.6.10", "ROM.1.26", "ROM.1.27", "LEV.18.22", "LEV.20.13",
    "SNG.1.2", "PRO.5.3", "PRO.5.4", "1TI.1.10",
  ],
  D_judgment: [
    "HEB.10.27", "MAT.10.28", "REV.21.8", "REV.22.15", "MAT.25.41", "PSA.145.20",
    "2PE.2.1", "2TH.1.9", "GAL.1.8", "GAL.1.9", "2PE.2.14", "LUK.12.5", "JHN.3.18",
    "JHN.8.44", "HOS.4.6", "ISA.66.24", "2TH.1.8",
  ],
  E_hyperbole: ["MAT.5.29", "MAT.5.30", "MAT.18.8", "MAT.18.9", "LUK.14.26"],
  F_misquoted: [
    "PRO.3.5", "PRO.3.6", "ROM.8.28", "PHP.4.13", "PSA.37.4", "MAT.6.33",
    "1CO.10.13", "JER.29.11", "GAL.6.7", "MAT.18.20", "PRO.22.6", "ISA.54.17",
    "2CH.7.14", "ECC.3.1", "MAT.21.22", "MAT.7.1", "JHN.14.13", "JHN.14.14",
    "JAS.4.3", "MAL.3.10",
  ],
  G_parable_voice: ["MAT.25.24", "MAT.25.26"],
};

export function parseAllowlistTsv(content) {
  const rows = [];
  for (const line of content.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const p = line.split("\t");
    if (p.length < 4) continue;
    rows.push({
      verseKey: p[0].trim().toUpperCase(),
      repeatCount: Number(p[1]),
      reference: p[2].trim(),
      text: p[3].trim(),
    });
  }
  return rows;
}

export function buildAuditItems(rows) {
  const byKey = new Map(rows.map((r) => [r.verseKey, r]));
  const keys = new Set(rows.map((r) => r.verseKey));
  const itemMap = new Map();

  function addItem(cat, verseKey, extra = {}) {
    const row = byKey.get(verseKey);
    if (!row) return;
    const existing = itemMap.get(verseKey);
    if (existing) {
      if (!existing.categories.includes(cat)) existing.categories.push(cat);
      Object.assign(existing, extra);
      return;
    }
    itemMap.set(verseKey, {
      verseKey,
      reference: row.reference,
      repeatCount: row.repeatCount,
      text: row.text,
      categories: [cat],
      ...extra,
    });
  }

  for (const [cat, verseKeys] of Object.entries(KNOWN)) {
    for (const k of verseKeys) addItem(cat, k);
  }

  for (const row of rows) {
    if (/、$/.test(row.text.replace(/[」』"]$/, ""))) addItem("H_open_list", row.verseKey);
  }

  for (const row of rows) {
    if (row.text.replace(/\s/g, "").length <= 12) addItem("I_short_fragment", row.verseKey);
  }

  for (const row of rows) {
    const m = row.verseKey.match(/^([A-Z0-9]{3})\.(\d+)\.(\d+)$/);
    if (!m) continue;
    const nextKey = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
    if (!row.text.endsWith("，") || !keys.has(nextKey) || row.repeatCount < 50) continue;
    const next = byKey.get(nextKey);
    addItem("J_split_pairs", row.verseKey, {
      pairWith: nextKey,
      pairReference: next?.reference ?? nextKey,
      pairText: next?.text ?? "",
    });
    if (next) addItem("J_split_pairs", nextKey, {
      pairWith: row.verseKey,
      pairReference: row.reference,
      pairText: row.text,
    });
  }

  const items = [...itemMap.values()].sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    const aSev = Math.min(...a.categories.map((c) => sev[CATEGORY_META[c]?.severity] ?? 9));
    const bSev = Math.min(...b.categories.map((c) => sev[CATEGORY_META[c]?.severity] ?? 9));
    return aSev - bSev || b.repeatCount - a.repeatCount || a.reference.localeCompare(b.reference, "zh");
  });

  return items;
}

export function defaultKeepSet(items) {
  const keep = new Set();
  for (const item of items) {
    const shouldKeep = item.categories.some((c) => CATEGORY_META[c]?.defaultKeep);
    if (shouldKeep) keep.add(item.verseKey);
  }
  return keep;
}

export function verseKeyToAudioFilenames(verseKey) {
  const m = verseKey.match(/^([A-Z0-9]{3})\.(\d+)\.(\d+)$/);
  if (!m) return [];
  const base = `${m[1]}-${m[2]}-${m[3]}-32kbps.mp3`;
  return [
    `golden-verses/${base}`,
    `golden-verses-web-en/${base}`,
  ];
}
