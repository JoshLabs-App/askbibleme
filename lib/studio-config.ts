/**
 * Studio 文档列表：顺序 = 左侧导航顺序。
 * 文件名约定：docs/{id}.md
 */
export const STUDIO_DOC_ENTRIES = [
  {
    id: "01-vision",
    labelEn: "Vision",
    labelZh: "产品愿景",
    remark: "做什么、为何在、不是什么",
  },
  {
    id: "02-user-psychology",
    labelEn: "User Psychology",
    labelZh: "用户心理",
    remark: "难进圣经、手机时代、缺什么",
  },
  {
    id: "03-principles",
    labelEn: "Principles",
    labelZh: "产品原则",
    remark: "不可破坏的原则、核心宪法",
  },
  {
    id: "04-ux-philosophy",
    labelEn: "UX Philosophy",
    labelZh: "体验哲学",
    remark: "打开时的感觉、气质与节奏",
  },
  {
    id: "05-emotional-design",
    labelEn: "Emotional Design",
    labelZh: "情绪设计",
    remark: "安静、陪伴与停留",
  },
  {
    id: "06-journey-system",
    labelEn: "Journey System",
    labelZh: "旅程系统",
    remark: "Journey 机制、为何回来",
  },
  {
    id: "07-content-rules",
    labelEn: "Content Rules",
    labelZh: "内容规范",
    remark: "克制、去 AI/说教/工具感",
  },
  {
    id: "08-mvp-scope",
    labelEn: "MVP Scope",
    labelZh: "最小可行范围",
    remark: "只做、不做",
  },
  {
    id: "09-dangerous-directions",
    labelEn: "Dangerous Directions",
    labelZh: "危险方向",
    remark: "毁掉产品的路、工具化",
  },
  {
    id: "10-parking-lot",
    labelEn: "Parking Lot",
    labelZh: "想法停车场",
    remark: "以后可能做、不进 MVP",
  },
] as const;

/** 内置 `01-vision` … 或附加 `ext-<uuid>` */
export type StudioDocId = string;

/** localStorage key；日后换数据库时可整段替换持久化层 */
export const STUDIO_STORAGE_KEY = "askbible-studio-docs-v1";

/** 右侧 AI 对话气泡（仅本机浏览器） */
export const STUDIO_AI_CHAT_STORAGE_KEY = "askbible-studio-ai-chat-v1";

/** 右侧 AI Discussion Panel（产品讨论区，仅本机浏览器） */
export const STUDIO_AI_DISCUSSION_STORAGE_KEY =
  "askbible-studio-ai-discussion-v1";

/**
 * 讨论记录同步文件（相对仓库根）。与 `/api/studio/save-docs` 同一套磁盘写入权限；
 * `npm run dev` 默认可写；`next start` 需 STUDIO_ALLOW_DISK_SAVE + Bearer。
 */
export const STUDIO_AI_DISCUSSION_DISK_FILE = "studio/ai-discussion.json";

/** Layer 1：长期产品记忆（AI 上下文最高优先级；仅人工确认后写入） */
export const STUDIO_PRODUCT_MEMORY_FILE = "studio/product-memory.md";

/** Layer 3：主题线程 Markdown 目录 */
export const STUDIO_THREADS_DIR = "studio/threads";

/** 是否仅显示右侧 AI 讨论区（全宽） */
export const STUDIO_DISCUSSION_FOCUS_ONLY_KEY =
  "askbible-studio-discussion-focus-only-v1";

/** AI Discussion 当前角色（仅存本机） */
export const STUDIO_DISCUSSION_ROLE_KEY = "askbible-studio-discussion-role-v1";

/** AI Discussion 角色显示名与规则（可编辑；仅存本机） */
export const STUDIO_DISCUSSION_ROLE_CONFIGS_KEY =
  "askbible-studio-discussion-role-configs-v1";

/**
 * 可选：与服务器环境变量 STUDIO_WRITE_SECRET 相同，仅在 `next start` 且
 * STUDIO_ALLOW_DISK_SAVE=1 时由浏览器随保存请求带上（仅存本机浏览器）。
 */
export const STUDIO_DISK_BEARER_STORAGE_KEY =
  "askbible-studio-disk-bearer-v1";
