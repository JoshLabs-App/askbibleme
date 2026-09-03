import { StyleSheet } from "react-native";
import { shellIconTextShadow } from "../shell/shellChromeIcons";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { parchmentSans } from "./readTypography";
import { JUMP_CATALOG_VIEWPORT_H } from "./readChapterScreenConstants";
import { READ_TOP_CHROME } from "./readTopChrome";

export const readChapterScreenChromeStyles = StyleSheet.create({
  jumpBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: c.modalBackdrop },
  jumpSheet: {
    width: "100%",
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  jumpSheetImageBg: {
    width: "100%",
  },
  jumpSheetContent: {
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  jumpSheetBgImage: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    opacity: 0.92,
  },
  jumpHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  jumpBackBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 249, 239, 0.72)",
  },
  jumpHeaderSpacer: {
    width: 30,
    height: 30,
  },
  jumpTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    lineHeight: 32,
    ...parchmentSans(700),
    color: c.ink,
    textAlign: "center",
  },
  jumpCatalogScrollWrap: {
    position: "relative",
    height: JUMP_CATALOG_VIEWPORT_H,
    overflow: "hidden",
  },
  jumpCatalogScroll: {
    height: "100%",
    width: "100%",
  },
  jumpClose: { marginTop: 4, alignSelf: "center", paddingVertical: 6 },
  jumpCloseText: { fontSize: 14, color: c.muted },
  topActions: {
    position: "absolute",
    zIndex: 50,
    gap: READ_TOP_CHROME.gap,
    alignItems: "center",
  },
  topLeftActionWrap: {
    position: "absolute",
    zIndex: 50,
    width: READ_TOP_CHROME.btnSize,
    height: READ_TOP_CHROME.btnSize,
    alignItems: "center",
    justifyContent: "center",
  },
  topSystemBack: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  topActionBtn: {
    width: READ_TOP_CHROME.btnSize,
    height: READ_TOP_CHROME.btnSize,
    borderRadius: READ_TOP_CHROME.btnSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  topActionPressed: {
    opacity: 0.86,
  },
  topActionDisabled: {
    opacity: 0.38,
  },
  topActionIcon: {
    ...shellIconTextShadow(),
  },
  /** 字号 + / −：同字号同字重 */
  topActionSizeLabel: {
    width: READ_TOP_CHROME.btnSize,
    textAlign: "center",
    fontSize: READ_TOP_CHROME.sizeLabelFontSize,
    lineHeight: READ_TOP_CHROME.sizeLabelFontSize + 2,
    fontWeight: "500",
    color: READ_TOP_CHROME.iconColor,
    includeFontPadding: false,
  },
  selectionBar: {
    position: "absolute",
    // 须高于 ShellTabBar(zIndex:100)，否则底部 Tab/播放坞会盖住确定键
    zIndex: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: "#1c1410",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  selectionCountText: {
    fontSize: 12,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  selectionActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  selectionBtn: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectionBtnPrimary: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    backgroundColor: "#FFB103",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectionBtnText: {
    fontSize: 12,
    ...parchmentSans(600),
    color: c.ink,
  },
  selectionBtnPrimaryText: {
    fontSize: 12,
    ...parchmentSans(600),
    color: "#8C4A0F",
  },
  verseActionBackdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  verseActionSheetWrap: {
    width: "100%",
  },
  verseActionSheet: {
    padding: 10,
    gap: 8,
  },
  verseActionTitle: {
    fontSize: 12,
    color: c.muted,
    textAlign: "center",
    ...parchmentSans(600),
  },
  verseActionBtn: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  verseActionBtnCancel: {
    marginTop: 2,
  },
  verseActionBtnText: {
    fontSize: 14,
    color: c.ink,
    ...parchmentSans(600),
  },
  verseActionBtnTextMuted: {
    color: c.muted,
  },
  verseActionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: { opacity: 0.88 },
});
