export const RELAX_VISUAL_EFFECT_STORAGE_KEY = "selah-relax-visual-effect-v1";

export const RELAX_VISUAL_EFFECT_IDS = ["lagoon"] as const;

export type RelaxVisualEffectId = (typeof RELAX_VISUAL_EFFECT_IDS)[number];

export const RELAX_VISUAL_EFFECT_DEFAULT: RelaxVisualEffectId = "lagoon";

/** i18n key for hint label（仅静湖） */
export const RELAX_EFFECT_TAB_I18N_KEY: Record<RelaxVisualEffectId, string> = {
  lagoon: "relax.effectLagoon",
};

/** 放松页仅保留静湖；历史存储一律视为静湖。 */
export function parseRelaxVisualEffectId(_raw: string | null): RelaxVisualEffectId {
  return RELAX_VISUAL_EFFECT_DEFAULT;
}
