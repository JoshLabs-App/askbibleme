# OpenBible 主题经文（本地 SQLite）

数据来源可为 [OpenBible.info/topics](https://www.openbible.info/topics) 导出的 tab 分隔表（Topic、OSIS、Quality Score）。

## 导入

1. 将完整 TSV 存为 `data/bible/openbible-topic-scores.tsv`（该路径已 `.gitignore`，大文件不必提交），或放在任意路径。
2. 在仓库根目录执行：

```bash
npm run import:openbible-topics
# 或指定文件：
npx tsx scripts/import-openbible-topic-scores.ts /path/to/topic-scores.txt
```

3. 生成 `data/bible/openbible-topics.sqlite`（默认已 gitignore），导入脚本会写入 **`verse_count`**（能解析为「同书同章连续 OSIS」时的节数；否则为 NULL）。
4. **若你手里是更早生成的 SQLite（没有 `verse_count` 列）**：在已允许读写的环境下，**首次请求**后台主题索引 API 会尝试自动 ALTER 并回填写盘；若失败（例如文件只读），再在仓库根目录手动执行：

```bash
npm run backfill:openbible-verse-count
```

5. 后台 **圣经 → 主题经文索引** 浏览、筛选；可按 **1 节 / 2 节 / 3 节 / 4 节及以上 / 无法解析** 筛 OSIS；展开行可加载译本正文（需已上传 `data/bible/` 译本 JSON）。

仓库内附带极小样例：`openbible-topic-scores.example.tsv`，可用于验证导入脚本。

## 主题中文显示（可选）

OpenBible 的 `topic` 字段为英文。后台 **主题经文索引** 会尝试显示中文：

1. 内置短语表与简单分词组合（覆盖有限）。
2. 可自行维护 **`data/bible/openbible-topic-zh.json`**（对象：英文主题 → 中文，键名大小写与空格会规范化，与英文 `topic` 一致即可）。可参考仓库内 `openbible-topic-zh.example.json` 复制改名使用。若不想把个人补全提交到 Git，可将该文件加入 `.gitignore`。

未命中映射时，界面仍显示英文主题作为回退。

含汉字的「主题包含」检索：服务端会在全部不重复 `topic` 上解析中文译名并做子串匹配（数据量大时略慢），不再仅用 SQL `LIKE` 英文列。
