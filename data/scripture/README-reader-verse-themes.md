# 中文主题标签墙（金句主题后台）

数据来自桌面项目 `BIBLE/data/reader_zh_cn_verse_categories.json`（与 `BIBLE/tag-wall.html` 同源结构）。本仓库不提交该大 JSON；改为导入为本地 SQLite：

- **输出**：`data/scripture/reader-verse-themes.sqlite`（已 `.gitignore`）
- **展示**：后台「圣经 → 金句主题」`/admin/read/golden-verse-themes`

## 导入

在仓库根目录执行（将路径换成你本机 BIBLE JSON 路径）：

```bash
npm run import:reader-verse-themes -- ~/Desktop/APP/BIBLE/data/reader_zh_cn_verse_categories.json
```

若 Node 解析 JSON 时内存不足，可尝试：

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run import:reader-verse-themes -- /path/to/reader_zh_cn_verse_categories.json
```

导入完成后刷新后台「金句主题」页即可。

## 说明

- 分桶与「复合标签」下二级分组逻辑与 `tag-wall.html` 内脚本一致（见 `lib/scripture/reader-verse-themes-bucket.ts`）。
- **库内不保存**第三方站点名称、参考链接、源 JSON 路径、导入时间等元数据；亦不写入 `category` / `subcategory` / `verse` 中的外链字段。仅保留：大主题与子标签名、`title` 文案、节数、分桶、经文引用与正文、以及解析得到的 AskBible `book_id`。
- 「打开读经」在书名可映射到 `lib/bible/scripture-books.ts` 中的中文名时生成。
