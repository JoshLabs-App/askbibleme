import { StyleSheet } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { parchmentSans, readTypography } from "./readTypography";

export const readChapterScreenLayoutStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  header: {
    width: "100%",
    paddingTop: 4,
    paddingBottom: 24,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    alignItems: "center",
  },
  chapterTitleBlock: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    paddingHorizontal: 8,
    gap: 6,
  },
  chapterTitle: {
    marginTop: 0,
    fontSize: readTypography.chapterTitleSize,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  chapterMeta: { marginTop: 4, fontSize: 12, color: c.muted, textAlign: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  prepareOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "rgba(249, 240, 222, 0.88)",
  },
  statusText: { fontSize: 14, color: c.muted },
  prepareProgressTrack: {
    marginTop: 4,
    width: "72%",
    maxWidth: 240,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(42, 23, 10, 0.12)",
  },
  prepareProgressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: c.parchmentAccent,
  },
  preparePercentText: { fontSize: 12, color: c.muted },
  errorText: { fontSize: 14, lineHeight: 22, color: c.muted, textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  retryBtnText: { fontSize: 14, ...parchmentSans(600), color: c.ink },
  scroll: { flex: 1 },
  scrollContent: {
    width: "100%",
    alignSelf: "center",
  },
});
