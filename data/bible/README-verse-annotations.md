# 经节预标注（SQLite v3）

译本数据库 `data/bible/sqlite/{translationId}.sqlite` 在 `verse` 表除正文外写入：

| 列 | 含义 |
|----|------|
| `speech_spans` | 神言 / 人话字符区间 JSON：`[[start,end,1\|2],…]` |
| `theme_repeat_count` | 主题库陈列次数（`reader-verse-themes.sqlite` 统计，未收录为 0） |
| `flags` | 扩展位；金句展示以 `theme_repeat_count` 为准 |

金句色带阈值：`lib/bible/golden-verse-theme-repeat.ts` 中 **`MIN_GOLDEN_THEME_REPEAT_COUNT = 3`**（陈列 ≥3 次才显示）。

构建：

```bash
npm run import:reader-verse-themes   # 可选，无则 theme_repeat_count 全为 0
npm run build:speech-spans-v1        # 可选，冻结全本 speech_spans v1 快照
npm run build:speech-spans-review-queue  # 可选，生成复核优先队列（优先四福音）
npm run build:speech-spans:auto-review   # 可选，自动把全量章节分级为 reviewed/needs-fix
npm run build:speech-spans:ai-gospels    # 可选，AI 扫四福音并写入 review-state 的 verseOverrides（默认顺带重建 sqlite + 同步 mobile scripture）
npm run build:speech-spans-v2        # 可选，应用 review-state 覆盖后生成 v2 快照
npm run build:bible-sqlite
npm run mobile:sync-scripture        # App 内置库
```

`build:speech-spans:ai-gospels` 默认读取环境变量：

- `AI_BASE_URL`（必填）
- `AI_MODEL`（必填）
- `AI_API_KEY`（可选）
- `SPEECH_SPANS_AI_TRANSLATIONS`（可选，默认 `cuv-simp`，逗号分隔）
- `SPEECH_SPANS_AI_APPLY_BUILD=0` 可仅写 review-state（不重建 sqlite）
- `SPEECH_SPANS_AI_SYNC_MOBILE=0` 可跳过 `mobile:sync-scripture`

若存在 `data/bible/annotations/speech-spans-v2.json`，`build:bible-sqlite` 会优先使用 v2；否则回退到 `speech-spans-v1.json`；都不存在时再回退启发式推断。

复核状态文件：`data/bible/annotations/speech-spans-review-state-v1.json`

- `chapterStatus` 键：`<translationId>:<BOOK>:<chapter>`，值：`todo` / `reviewed` / `needs-fix`
- `verseOverrides`：逐节覆盖 `speech_spans`，形如：
  - `{"cuv-simp":{"MAT:13:10":"[[12,26,2]]"}}`

旧版 SQLite 缺列时，读经页回退运行时说话推断；`theme_repeat_count` 视为 0。
