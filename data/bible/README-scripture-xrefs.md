# 经文交叉引用（策展版）

读经页「相关经文 / 被引用于」来自 **CrossReferences.org** 整理的 KJV TSK 数据，经本仓库脚本筛选后写入 SQLite。

## 来源与许可

- 原始 TSV：[CrossReferences-org/bible-cross-references](https://github.com/CrossReferences-org/bible-cross-references) → `kjv/crossreferences_kjv.tsv`
- 底本：Treasury of Scripture Knowledge（维护方有删改，非全量 verbatim）
- 许可：**CC BY-SA 4.0** — 产品关于页需署名 [CrossReferences.org](https://crossreferences.org)

## 文件

| 路径 | 说明 |
|------|------|
| `cross-references/raw/crossreferences_kjv.tsv` | 上游 TSV（可 `curl` 重新下载） |
| `cross-references/xref-curation.config.json` | 每节上限、优先级权重 |
| `cross-references/curated-overrides.json` | 人工 `add` / `remove` 边 |
| `sqlite/scripture-xrefs.sqlite` | 构建产物（`xref_out` + `xref_in`） |

## 构建

```bash
# 若缺 raw TSV：
curl -fsSL -o data/bible/cross-references/raw/crossreferences_kjv.tsv \
  https://raw.githubusercontent.com/CrossReferences-org/bible-cross-references/main/kjv/crossreferences_kjv.tsv

npm run build:scripture-xrefs
npm run build:scripture-xrefs -- --report   # 样本章验收输出

npm run mobile:sync-scripture               # 含 xref sqlite 复制到 App
```

## 筛选规则（摘要）

1. 同节多 anchor 合并去重；跳过空 anchor
2. 优先级：跨约 > 高频被引目标 > 多 anchor 共识 > 同卷
3. 候选边须为 **跨约**（priority ≥ `minEdgePriorityToKeep`，默认 **100**）；写入库的边须 ≥ `minVersePriorityToPublish`（默认 **150** = 跨约 + 高频被引）
4. 每节最多 **4** 条 outgoing、**4** 条 incoming；须含跨约边才显示节号入口
5. `curated-overrides.json` 在筛选后覆盖（`add` 优先级 999）

## 人工增补

编辑 `curated-overrides.json`：

```json
{
  "add": [{
    "from": { "bookId": "LUK", "chapter": 4, "verse": 18 },
    "to": { "bookId": "ISA", "chapter": 61, "verseStart": 1, "verseEnd": 2 },
    "note": "引文"
  }],
  "remove": []
}
```

改完后重新 `npm run build:scripture-xrefs`。
