import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";

export const shellNavDrawerLayoutStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(236, 217, 185, 0.66)",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(120, 53, 15, 0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 16,
    overflow: "hidden",
  },
  drawerBg: {
    flex: 1,
    backgroundColor: "rgba(236, 217, 185, 0.62)",
  },
  drawerBgImage: {
    opacity: 0.92,
  },
  drawerContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 6,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 14,
    ...parchmentSans(600),
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.55)",
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  closeBtnPressed: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  scroll: {
    flex: 1,
  },
  compactGap: {
    height: 4,
  },
  sectionLabelCompact: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.46)",
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  poolSelectTrigger: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.2)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  poolSelectTriggerPressed: {
    backgroundColor: "rgba(255, 177, 1, 0.14)",
  },
  poolSelectLabel: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.72)",
  },
  poolSelectValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  poolSelectValue: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.9)",
    ...parchmentSans(600),
  },
  poolSelectOptions: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.2)",
    backgroundColor: "rgba(255, 248, 235, 0.58)",
    overflow: "hidden",
  },
  poolSelectOption: {
    minHeight: 30,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(120, 53, 15, 0.12)",
  },
  poolSelectOptionActive: {
    backgroundColor: "rgba(255, 177, 1, 0.16)",
  },
  poolSelectOptionText: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.82)",
  },
  poolSelectOptionTextActive: {
    color: "rgba(120, 75, 30, 0.96)",
    ...parchmentSans(600),
  },
  poolSelectOptionGroup: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
  },
  poolSelectOptionGroupText: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.46)",
    ...parchmentSans(600),
  },
  poolSelectOptionIndent: {
    paddingLeft: 18,
  },
});
