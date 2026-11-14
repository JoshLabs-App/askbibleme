# 三端发布 · 2026-11-04

- PR 49 已通过 CI 并合入 main：901776d5937c6c8f74ba6668781987812d6acaf3。
- Web: https://askbible.me/app-build.json 与 main 完整 SHA 一致。正式站浏览器通过左右换景、开启环境音随景、静音后换景保持关闭、上拉调整、暂停状态长按选专辑、下拉音乐与返回、探索去除文档卡片。桌面深色与键盘路径在本地通过。保留旧部署 askbibleme-pqsi0q7az-joshlabsapp.vercel.app。仅本地预构建，上传使用 vercel deploy --prebuilt。
- iOS: App Store Connect 核实 1.1.7 (140)，WAITING_FOR_REVIEW，AFTER_APPROVAL。模拟器 Maestro 长按选专辑、音乐页往返、环境音跟景/静音、全景与目录互切均通过。
- Android: Google Play production API 核实 1.0.54 / 251 completed。官网下载版 version.json 及下载 APK 的 aapt 标识均核实。三星独立测试包已覆盖安装；最后一轮真机因再次锁屏未完成，系统熄屏时间恢复 600000。Android 模拟器补验：下拉音乐、返回、长按选择、上拉调整；通过截图确认雨夜选中雨声、关闭后回湖景保持关闭。切换专辑后 MediaSession 为 PLAYING，元数据安静。
