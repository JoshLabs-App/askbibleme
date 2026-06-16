import { StyleSheet } from "react-native";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

/**
 * 羊皮卷壳层内表单控件默认真源（对齐 lib/shell/parchment-control-surface.ts）。
 */
export const parchmentControlSurface = {
  fill: "rgba(255, 252, 245, 0.52)",
  fillMuted: "rgba(255, 252, 245, 0.38)",
  fillStrong: "rgba(255, 252, 245, 0.62)",
  border: c.border,
  borderFocus: c.borderStrong,
  selectionBand: "rgba(42, 36, 28, 0.06)",
  wheelRowHeight: 44,
  wheelVisibleRows: 5,
  radiusMd: 12,
  radiusSm: 10,
  radiusPill: 999,
} as const;

export const parchmentControlStyles = StyleSheet.create({
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    borderRadius: parchmentControlSurface.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: c.ink,
    backgroundColor: parchmentControlSurface.fill,
    textAlign: "center",
  },
  pickerWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: parchmentControlSurface.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    backgroundColor: parchmentControlSurface.fill,
  },
  pickerSelectionBand: {
    position: "absolute",
    left: 8,
    right: 8,
    top: "50%",
    marginTop: -parchmentControlSurface.wheelRowHeight / 2,
    height: parchmentControlSurface.wheelRowHeight,
    borderRadius: parchmentControlSurface.radiusSm,
    backgroundColor: parchmentControlSurface.selectionBand,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    zIndex: 0,
  },
  ghostBtn: {
    minWidth: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: parchmentControlSurface.radiusPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    backgroundColor: parchmentControlSurface.fillMuted,
  },
  optionalSetBtn: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: parchmentControlSurface.radiusPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    backgroundColor: parchmentControlSurface.fill,
  },
});

/** 探索弹层内：轻 tint 叠在羊皮底图上（与默认控件一致，勿用纯色块盖住纹理） */
export const parchmentModalControlStyles = parchmentControlStyles;

/** 叠在羊皮卷页 overlay 上：控件只留边框与轻 tint，不盖住底纹。 */
export const parchmentOverlayControlStyles = StyleSheet.create({
  field: {
    ...parchmentControlStyles.field,
    backgroundColor: "rgba(255, 252, 245, 0.22)",
  },
  pickerWrap: {
    ...parchmentControlStyles.pickerWrap,
    backgroundColor: "rgba(255, 252, 245, 0.18)",
  },
  pickerSelectionBand: parchmentControlStyles.pickerSelectionBand,
  ghostBtn: {
    ...parchmentControlStyles.ghostBtn,
    backgroundColor: "rgba(255, 252, 245, 0.24)",
  },
  optionalSetBtn: {
    ...parchmentControlStyles.optionalSetBtn,
    backgroundColor: "rgba(255, 252, 245, 0.22)",
  },
});
