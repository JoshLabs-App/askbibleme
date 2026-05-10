# AGENTS.md — Selah.my

## 产品边界（必读）

- Selah.my **不是** Bible Tool。
- **不是** AI Bible Chatbot。
- **不是** 游戏化圣经。
- **不是** 资料库 / 百科。

**核心方向**：一个让人**重新进入圣经的安静入口**。

## 当前开发重点

- 优先：**Selah.my Studio**（**产品大脑**：文档 + 本地 AI + 写回 `docs/`；见上文「Studio 定位」）。
- **不要**先做：用户端圣经 App、Journey 内容系统、CMS。

## Studio 定位（核心定义）

**Selah.my Studio 不是「后台」**，也不是 CMS、Notion 替代品、AI Chat 或单纯内容编辑器。

它是 **Selah.my 的「产品大脑」**（产品哲学操作系统）：目标不是管理页面或用户，而是 **持续校准产品方向**——防止慢慢变成「又一个 Bible App」、防止 **产品失忆**。身份上更接近 **Curator（策展人）** 与 **编辑部**：守护核心体验与产品语言，而不是企业运营后台。

- **最大风险**：不是开发做不出来，而是 **失去核心**（功能堆叠、工具化、认知负荷上升）。因此 **`docs/09-dangerous-directions.md` 与原则类文档极其重要**。
- **贴入摘录 / 草稿后，AI 应做的事**（与右侧动作对应）：**理清意图**（先概括你在忙什么，并建议 2～4 个可执行的下一步方向，对应其它动作）、**提炼**、**归类**、**检矛盾**、**防功能蔓延**、**压缩删减**、**原则与用语**（边界见同段下文）。
- **边界**：AI **不**应代替创始人思考、**不**应自动生成整站产品、**不**应默认扩功能；应帮助 **澄清、警告、删减、对齐语言**。
- **未来设想**（仅记录、不擅自实现）：三种 AI 人格分工——**Philosopher**（原则与跑偏）、**Editor**（压缩与去 AI 味）、**Experience Critic**（安静感与认知负荷）——见 `docs/10-parking-lot.md`。

## 气质与结构（界面层）

- 参考 **Codex** 的协作结构（左上下文 / 中工作区 / 右 AI），但**不要**做成开发者工具。
- 气质：**Codex 的结构 + Notion 的易用 + Calm 的安静感**。
- 面向创始人与产品思考，低认知负荷。

## 工作方式

- 所有开发保持**低认知负荷**。
- **不允许**擅自扩展功能；超出范围的想法写入 `docs/10-parking-lot.md`，**不要**在代码里实现。

## 技术栈与部署（约定）

| 层级 | 选型 |
|------|------|
| **Frontend（前台 + Studio）** | Next.js **App Router** + **TypeScript** + **Tailwind CSS** |
| **Backend（后端）** | **Supabase**：PostgreSQL + Auth + Storage + Edge Functions |
| **Deploy（部署）** | **Vercel**（Next）+ **Supabase**（数据与边缘逻辑） |
| **Mobile App（以后）** | 先 **PWA**；后期再评估 **Expo / React Native** |

说明：Studio 当前可有 **localStorage** 过渡；与 Supabase 同步、账号与正式数据写入以本表为准逐步实现。**未接 Supabase 前**不在此仓库假装已完成云端后端。

## 本地开发（减少 Next 报 chunk 丢失）

- 日常：**`npm run dev`**（Turbopack，**不再**每次启动删 `.next`——避免你开第二个终端又跑 `dev` 时，把第一个正在跑的实例的 `.next` 删掉，出现 `ENOENT` / 缺 `[turbopack]_runtime.js`）。
- 卡住或奇怪报错时：**`npm run dev:fresh`**（先 `clean` 再起）。
- 若必须用 Webpack：**`npm run dev:webpack`**（先 `clean`；`next.config` 里 dev 下关闭了 Webpack 缓存）。
- **`dev:hot`** 与 **`npm run dev`** 相同（保留别名）。

### Studio 调试（开发者）

- 右侧 AI 讨论区缓存在浏览器本地；若在开发时**需要重置讨论内容以验证新版交互**，可在开发者工具 Application → Local Storage 中移除键 `askbible-studio-ai-discussion-v1`。请勿在产品界面要求普通用户执行此类操作。
- 讨论记录会在允许的磁盘写入环境下**额外备份到仓库根目录 `studio/ai-discussion.json`**（与 `save-docs` 同一权限：`npm run dev` 默认可写；`next start` 需 `STUDIO_ALLOW_DISK_SAVE` + Bearer）。可纳入 Git 备份；若内容敏感可自行加入 `.gitignore`。

## AI 与仓库

- 本文件供人类与 AI Agent 阅读；Agent 改动代码前应核对上述边界。
