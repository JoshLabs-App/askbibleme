# Web 生产构建补充验收

完整生产构建和产物的本地启动检查已通过。无需 Joshua 提供凭据或修复环境文件；未发布。

## 原因

1. `data/scripture/reader-verse-themes.sqlite` 是已有的零字节文件，且被 `.gitignore` 排除。SQLite 将其作为无表的空数据库打开；`loadThemeRepeatCountMap` 检查文件存在后直接查询 `verse`，因此出现 `no such table: verse`。这是本机可选主题库残留，项目已有缺库时沿用已提交经文库主题计数的回退。
2. `.env.local` 是被 Git 忽略的失效符号链接，目标 `/Users/joshua/Desktop/APP/00/projects/01AskBible/.env.local` 不存在。Next 生产构建访问该路径时报 `stat ENOENT`。未找到证据证明它应改指向其它位置，因此没有猜测、重建或改写凭据文件。

## 安全处理

沿用仓库已有 `scripts/deploy-direct.sh` 的独立目录构建约定，但本次不调用发布脚本、不联网拉取配置、不提交或部署：

- 将当前工作区的 Web 源码复制到临时目录，包含本次 7 个 Web 改动文件。保留当前源码内容；5144 个文件的 SHA-256 记录在 `source-manifest.json`。
- 与发布约定一致，省略本机被忽略的数据库、环境文件和符号链接；原文件不动。
- 仅从已有 `.env.web-build.local` 读取 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_MEMBER_REGISTER_ENABLED` 三个公开构建项，写入临时目录。没有读取、变更或补造服务端秘密。
- 本机复制现有 `node_modules`，没有安装依赖；执行完整的 `npm run build`，没有跳过 prebuild。

可复现命令（从仓库根目录执行，仅构建、不部署）：

```bash
node work/music-resume-2026-11-05/build-verification/verify-web-build.mjs
```

脚本保留临时产物路径供本地启动验收，路径写在 `stage-path.txt`。本次验收后已停止测试服务器并删除这份临时产物，日志和结果仍保留。

## 实际结果

- `npm run build`：退出码 **0**，约 **61 秒**，Next.js 15.5.18 / 已有 Node 25.9.0。
- prebuild 生成 **1178** 个静态经文文件及 **66** 个交叉引用文件。
- 比较源目录与产物的 **19** 个经文数据库：经文节数、主题计数总和、带主题标记的节数全部一致，见 `theme-count-verification.json`。
- 产物以 `next start -H 127.0.0.1 -p 3467` 在本机启动：`/music`、`/web`、`/app-build.json`、`/scripture/cuv-simp/GEN.json`、`/xrefs/GEN.json` 均 **200**；页面引用的 **27** 个 JS 资源全部 **200**。
- 生产环境保护仍有效：`/admin` 和 `/studio` 均 **404**；`/api/music/companion` 保留原有 R2 **307** 跳转。
- 音乐 UI/续播交互沿用前一阶段的 Chrome 实测；本次未修改应用源码，只补验完整生产构建与产物可运行性。

主要证据：`build.log`、`result.json`、`runtime-smoke.json`、`theme-count-verification.json`、`input-preservation.json`。

原工作区直接执行 `npm run build` 仍会读到那两个本机残留；支持的独立目录构建已经可用，因而它们不再阻塞本任务验证。项目声明的 Node 22.x 与当前运行时版本差异仍记录在案，但没有导致本次构建失败。
