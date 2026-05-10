import type { AssistantActionId } from "./types";

/** UI：中文主标 + 备注；`labelEn` 供 title / 与后端 action id 对照 */
export const STUDIO_ASSISTANT_BUTTONS: {
  id: AssistantActionId;
  label: string;
  remark: string;
  labelEn: string;
}[] = [
  {
    id: "clarify_intent",
    label: "理清意图",
    remark: "当前这段内容真正想解决什么？",
    labelEn: "Clarify Intent",
  },
  {
    id: "summarize_insight",
    label: "提炼要点",
    remark: "压缩成核心洞察。",
    labelEn: "Summarize Insight",
  },
  {
    id: "classify_to_docs",
    label: "归类到文档主题",
    remark: "属于 Vision / Principles / UX 等哪类。",
    labelEn: "Classify to Docs",
  },
  {
    id: "detect_contradictions",
    label: "发现矛盾与张力",
    remark: "是否与已有原则冲突。",
    labelEn: "Detect Contradictions",
  },
  {
    id: "suggest_principle",
    label: "建议产品原则",
    remark: "是否形成新的产品原则。",
    labelEn: "Suggest Principle",
  },
  {
    id: "detect_feature_creep",
    label: "防功能蔓延",
    remark: "是否正在变成工具、平台、百科。",
    labelEn: "Detect Feature Creep",
  },
  {
    id: "rewrite_concisely",
    label: "改写得更短",
    remark: "去 AI 味、去长篇、保持克制。",
    labelEn: "Rewrite Concisely",
  },
  {
    id: "remind_core_drift",
    label: "提醒核心偏移",
    remark: "是否偏离「重新进入圣经」。",
    labelEn: "Remind Core Drift",
  },
  {
    id: "map_product_links",
    label: "建立关联",
    remark: "与 Journey / Gentle Return / Reading First 的关系。",
    labelEn: "Map Product Links",
  },
  {
    id: "suggest_next_focus",
    label: "建议下一步",
    remark: "现在最应该继续思考什么。",
    labelEn: "Suggest Next Focus",
  },
];
