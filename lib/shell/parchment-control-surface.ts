/**
 * 羊皮卷壳层内表单控件默认真源（Web CSS 变量 + 移动端 StyleSheet 对齐同一组值）。
 * 用于输入框、滚轮选择器、次要按钮等「浮在羊皮底上」的控件表面。
 */
export const PARCHMENT_CONTROL_SURFACE_TOKENS = {
  fill: "rgba(255, 252, 245, 0.52)",
  fillMuted: "rgba(255, 252, 245, 0.38)",
  fillStrong: "rgba(255, 252, 245, 0.62)",
  border: "rgba(120, 53, 15, 0.28)",
  borderFocus: "rgba(120, 53, 15, 0.42)",
  selectionBand: "rgba(42, 36, 28, 0.06)",
  wheelRowHeight: 44,
  wheelVisibleRows: 5,
  radiusMd: 12,
  radiusSm: 10,
  radiusPill: 999,
} as const;

/** Web：`app/(app-shell)/parchment-control-surface.css` */
export const PARCHMENT_CONTROL_SURFACE_CLASS = {
  field: "parchment-control-field",
  picker: "parchment-control-picker",
  pickerColumn: "parchment-control-picker__column",
  pickerRow: "parchment-control-picker__row",
  pickerRowSelected: "parchment-control-picker__row--selected",
  sheet: "parchment-control-sheet",
  modalBackdrop: "parchment-control-modal-backdrop",
  modalOverlay: "parchment-control-overlay",
  modalDim: "parchment-control-modal-dim",
  btn: "parchment-control-btn",
  btnPrimary: "parchment-control-btn parchment-control-btn--primary",
  label: "parchment-control-label",
} as const;
