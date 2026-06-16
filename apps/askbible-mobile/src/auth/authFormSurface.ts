import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";

/** 登录 / 注册：窄栏羊皮卷表单样式（对齐网站 authFormSurface + parchmentControlSurface） */
export const authFormSurface = StyleSheet.create({
  column: {
    width: "100%",
    alignSelf: "center",
  },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8 },
  backText: {
    fontSize: 14,
    color: c.faint,
    ...parchmentSans(500),
  },
  title: {
    marginTop: 8,
    fontSize: 18,
    color: c.ink,
    textAlign: "center",
    ...parchmentSans(600),
  },
  intro: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: c.muted,
    textAlign: "center",
    ...parchmentSans(400),
  },
  form: { marginTop: 24, gap: 10 },
  label: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: c.muted,
    ...parchmentSans(600),
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    borderRadius: parchmentControlSurface.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 50,
    fontSize: 17,
    lineHeight: 24,
    color: c.ink,
    backgroundColor: parchmentControlSurface.fillStrong,
    ...parchmentSans(400),
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: "#b42318",
    textAlign: "center",
    ...parchmentSans(500),
  },
  submit: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: parchmentControlSurface.radiusMd,
    backgroundColor: "rgba(28, 20, 16, 0.1)",
  },
  submitPressed: { opacity: 0.88 },
  submitDisabled: { opacity: 0.55 },
  submitText: { fontSize: 15, color: c.ink, ...parchmentSans(600) },
  linkBtn: { marginTop: 14, alignItems: "center", paddingVertical: 8 },
  linkText: {
    fontSize: 13,
    color: c.muted,
    textDecorationLine: "underline",
    ...parchmentSans(500),
  },
});
