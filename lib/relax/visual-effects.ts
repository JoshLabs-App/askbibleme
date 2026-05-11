export const RELAX_VISUAL_EFFECT_STORAGE_KEY = "selah-relax-visual-effect-v1";

export const RELAX_VISUAL_EFFECT_IDS = ["lagoon", "orb", "ripple", "afterglow", "float", "pillar"] as const;

export type RelaxVisualEffectId = (typeof RELAX_VISUAL_EFFECT_IDS)[number];

export const RELAX_VISUAL_EFFECT_DEFAULT: RelaxVisualEffectId = "lagoon";

/** i18n key for segmented tab label */
export const RELAX_EFFECT_TAB_I18N_KEY: Record<RelaxVisualEffectId, string> = {
  lagoon: "relax.effectLagoon",
  orb: "relax.effectOrb",
  ripple: "relax.effectRipple",
  afterglow: "relax.effectAfterglow",
  float: "relax.effectFloat",
  pillar: "relax.effectPillar",
};

export function parseRelaxVisualEffectId(raw: string | null): RelaxVisualEffectId {
  if (
    raw === "lagoon" ||
    raw === "orb" ||
    raw === "ripple" ||
    raw === "afterglow" ||
    raw === "float" ||
    raw === "pillar"
  )
    return raw;
  return RELAX_VISUAL_EFFECT_DEFAULT;
}
