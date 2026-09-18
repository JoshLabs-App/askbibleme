# iOS 原生端视觉优化：Liquid Glass 方案（进行中）

日期：2026-09-15 · 范围：`apps/askbible-ios`（SwiftUI，Xcode 26.6 / iOS 26.5 SDK，deployment target 17.0）
其它端：安卓与网页本轮不动，等 iOS 定稿后再对齐语言。

## 0. 现状盘点（代码事实，不是印象）

- 全仓 Swift 里 **零** `Material` / `glassEffect` / `blur(radius:)` 命中 —— 现有层次感 100% 靠 `drop shadow` + 1px 描边（`ParchmentTheme.swift`）。
- 羊皮配色两套（light/dark）逐值搬自 RN 的 `readParchmentTheme.ts`，两端双写、靠 shared-fixtures 对拍。任何配色改动都要同步网页/RN，否则对拍会炸。
- 首页：全屏场景视频/柔焦静帧 + 白色金句，可读性靠 `verseBodyShadow()`（黑 0.55 / r4）与 `shellIconShadow()`（两层黑影）。
- 底栏 `ShellTabBar`：5 位，中央 60pt FAB，完全透明；只有「读经坞在显示时」才在坞+底栏后铺一层 `ParchmentPinnedBottom`。正文不被遮挡靠 scroll mask 渐隐。
- 读经坞 `PlaybackDock`：hairline 上边线 + 自绘进度条，底色由 `ShellTabBarHost` 连坞一起铺，坞与底栏之间 6pt 缝。
- 环境就位：Xcode 26.6 + iOS 26.5 SDK，Liquid Glass API 全部可用；但 target 17.0 意味着所有新 API 都要 `if #available(iOS 26)` 双路。

## 1. 问题清单（我的代码盘点 + GPT 评审合并，按严重度）

1. **首页金句靠双层黑色投影保可读**（★★★★★）。视频明暗一直变，投影给不出稳定对比度，白字边缘发脏，金句从「场景的一部分」掉成「压在视频上的字幕」。结论一致：这个机制要废掉，改成材质提供层次，不是继续调 shadow 参数。
2. **透明底栏是结构性错误**（★★★★★）。底栏没有自己的视觉层，内容滚过去时读性差；阅读页更糟——经文 / 6pt 缝 / 读经坞 / 6pt 缝 / 底栏，是四个各自画的矩形叠在一张纸上，而不是一个浮在内容之上的控制层。
3. **5 位底栏 + 60pt 中央 FAB + 36pt MaterialIcons 字形**（★★★★☆）。这套组合的视觉行为离原生 Tab Bar 太远，图标明显偏大，用户读到的是「App 自己画的一套导航」。中央「读经计划」的特殊性可以留，但不该继续是安卓式大 FAB。
4. **阅读页没把「内容是主角」做到位**（★★★★☆）。顶部只有返回键和标题，看似克制，其实当前书卷/章节位置表达不足，高亮与书签缺少自然的上下文入口；羊皮底本身存在感又强，于是整页变成「一张羊皮纸 + 一堆浮在上面的控制」。三语排版本该承担信息层级，现在压在控件上。
5. **抽屉菜单纯色侧滑，与整体脱节**（★★★☆☆）。首页是自然视频、阅读页是羊皮纸、底部是自定义透明导航，抽屉突然是一块纯色矩形，等于告诉用户「这里是另一个 UI 系统」。

## 2. 三条候选方向（GPT 出的三种设计主张，不是三档强弱）

| | Direction 1 Glass as Instrument | Direction 2 Living Scripture | Direction 3 Native Quiet |
|---|---|---|---|
| 谁是主角 | 经文 + 场景 | 羊皮纸 | 经文本身 |
| Glass 用在哪 | 只用在控制层 | 羊皮世界里的现代工具 | 几乎整个 UI |
| 羊皮纸角色 | 内容材质 | 核心视觉材质（升级成真 substrate：细纹理、非均匀色温、边缘暗化） | 只做背景 |
| 首页 | 场景 + 玻璃控制簇（齿轮展开改成一个 GlassEffectContainer 内的紧凑 cluster，不是一排玻璃按钮） | 场景上压一层半透明羊皮色纱，形成 视频→纸→玻璃 三层深度 | 极简原生，取消齿轮展开模式，环境音等进 sheet |
| 阅读页 | 羊皮保留，读经坞改走 `tabViewBottomAccessory` 并入 TabView | parchment-first，顶栏靠 `scrollEdgeEffect` 在贴顶时融入纸、滚动后浮起；`backgroundExtensionEffect` 让纸延伸到系统 UI 之后，不硬切 | native-first：系统 toolbar / selection / context menu / bottom accessory |
| 主要 API | glassEffect、GlassEffectContainer、glassEffectID + union、tabViewBottomAccessory、scrollEdgeEffect | 同上，外加 backgroundExtensionEffect | 吃满全套，并大幅减少自绘 ZStack / stroke / shadow |
| 品牌辨识度 | 高 | 最高 | 最低 |
| 改动幅度 | 中 | 中高 | 高 |
| 最大风险 | 玻璃泛滥，变成 Liquid Glass Demo | 过度拟物，变成 Bible-themed skin | 品牌消失，像「苹果自己做的圣经阅读器」 |

**核心设计原则（本轮最值得抓住的一句，GPT 与我一致）**：不要让羊皮纸和玻璃「融合」，而是语义分工——

> 你正在读的时候，你看到的是纸；你正在操作的时候，你触碰的是玻璃。
>
> Paper = Scripture，Glass = Interface。

GPT 的推荐（也是我的推荐）：**以 Direction 1 为主架构，吸收 Direction 2 对羊皮纸的材质处理**。首页 = 自然场景 → 经文 → 玻璃控制；阅读页 = 羊皮 → 经文 → 玻璃 accessory / 导航；系统导航交给原生 Liquid Glass；品牌由羊皮 + 琥珀 + 经文排版 + 自然场景 + 声音承担。

## 3. 兼容策略（iOS 17–25）：一套设计，两套 renderer

不要做「17-25 走老设计、26 走新设计」，那等于长期维护两套。做法是**设计系统只有一套，材质 renderer 有两套**：

- 建语义组件层：`AskSurface` / `AskControl` / `AskToolbar` / `AskBottomBar` / `AskAccessory` / `AskHighlight`，页面只用这些，**不在页面里直接写 `.glassEffect(...)`**。
- 组件内部按 `if #available(iOS 26)` 分叉：26+ 走 `glassEffect`，17–25 走 `.background(.ultraThinMaterial)` + overlay 描边。尺寸、padding、圆角、层级、交互路径完全一致，只有材质不同。
- 五类 token 统一：Surface（primary / secondary / control）、Elevation（content / floating / overlay，不再靠一堆 shadow）、Corner（control / card / sheet）、Tint（`#FFB101` 保留但降为「重要状态」专用，不再所有选中图标都变黄）、Scripture 语义色（`ScriptureBackground` / `ScripturePrimaryText` / `ScriptureSecondaryText` / `ScriptureAccent`，替掉散落各页的 `#ecd9b9`）。

注意本仓的既有约束：羊皮配色与 RN / 网页双写，改 token 必须同步 `readParchmentTheme.ts`，否则 shared-fixtures 对拍会失败。


## 5. 第一轮已落地（2026-09-15 / 16，模拟器 iPhone 14 Pro Max / iOS 26.5 实测）

方向已定：**D1 Glass as Instrument 主架构 + D2 羊皮材质**，羊皮卷底纹保留（Josh 要求）。决定见 `docs/DECISIONS.md`。

| 改了什么 | 文件 |
|---|---|
| 新增语义材质层 `AskSurface` 族：`askGlassCapsule` / `askGlassRect` / `askFloatingShadow` / `AskGlassGroup`（iOS 26 `glassEffect` + `GlassEffectContainer`，17–25 `.ultraThinMaterial` + hairline），版本分叉只在这一个文件里 | `Theme/AskGlass.swift`（新） |
| 羊皮升级成 substrate：`parchment.jpg` 整图铺底不变，叠一层极轻的边缘晕暗（light 0.13 / dark 0.16）+ 5% 斜向暖调不均 | `Shell/ParchmentBackground.swift` |
| 读经坞 + 底栏合成**一块**浮起的玻璃胶囊，取消 6pt 缝、取消坞后面铺实纸（`ParchmentPinnedBottom` 不再用在底栏），纸从玻璃后面连续延伸 | `Shell/ShellTabBar.swift`、`Read/PlaybackDock.swift` |
| 底栏图标按底色分调：视频页白图标 + 品牌黄选中；羊皮页墨色图标 + 琥珀 `accentOt` 选中。所有 `shellIconShadow()` 双层黑影从壳层去掉 | `Shell/ShellTabBar.swift` |
| 首页金句废掉 `verseBodyShadow()`，改成一小片局部暗化（径向渐变 + blur 18） | `Home/HomeView.swift` |
| 首页齿轮 / 菜单改玻璃小圆钮（`interactive`，按下有形变）；齿轮展开的字号 / 定时 / 环境音 / 场景条收进**一块**玻璃控制簇；专辑排单独一块玻璃胶囊，两块同处一个 `AskGlassGroup` | `Home/HomeView.swift` |
| 羊皮页右栏壳层按钮（设置 / 搜索 / 书签 / 字号 ± / 最近）改浅调玻璃圆钮 + 墨色图标，图标缩到 0.84× | `Read/CatalogView.swift`、`Read/ChapterView.swift` |
| 章页底部补渐隐（等价于 `scrollEdgeEffect`）：坞变玻璃后经文会从胶囊圆角处露出半行，内容现在在浮起控件前先淡掉 | `Shell/ParchmentFade.swift` |

**验证**：`xcodebuild ... -sdk iphonesimulator` 通过，无新增警告；在 iPhone 14 Pro Max / iOS 26.5 模拟器上逐屏看过首页、抽屉、圣经目录、章节选择、创世记 1（含读经坞）。截图 `docs/design-concepts/2026-09-16-ios26-{home,read}-glass.png`。

**调参记录**（省得下个线程重新试）：iOS 26 的 `.glassEffect(.regular)` 不给 tint 在明亮照片上会发白、白图标读不清；给太重（0.34）又变成灰塑料板。现值：暗调 `#1d1206` 0.18，浅调 `#fdf3de` 0.12。模拟器渲染的玻璃没有真机的折射，真机上会更透。

## 6. 第二轮已落地（2026-09-16）

| 改了什么 | 文件 |
|---|---|
| 壳层换成原生 `TabView`（`AskTabShell`）：iOS 26 系统 Liquid Glass Tab Bar；SF Symbols + 三语标签；中央 FAB 降为普通 Tab，切到它触发 `onEnterPlan`（今日读经）；选中色琥珀 | `Shell/ShellTabBar.swift`、`AskBibleApp.swift` |
| 读经坞挂进 `tabViewBottomAccessory`；坞加紧凑档（播放 / 时间 / 进度 / 下一章），点中间弹出完整 transport 的矮 sheet（羊皮底） | `Read/PlaybackDock.swift`、`AskBibleApp.swift` |
| `shellBottomInset` 变空实现 —— 底栏与 accessory 的高度由系统计入安全区，页面不再自己算 | `Shell/ShellTabBar.swift` |
| 抽屉改成浮在内容上的玻璃面板（`AskCorner.sheet` + overlay 档影子），去掉羊皮底与右侧 hairline | `Shell/NavDrawer.swift` |
| Corner / Elevation token（`AskCorner`、`AskElevation`）与 Scripture 语义色（`scriptureBackground` / `scripturePrimaryText` / `scriptureSecondaryText` / `scriptureAccent`） | `Theme/AskGlass.swift`、`Theme/ParchmentTheme.swift` |

**逐屏验证**（iOS 26.5 模拟器）：首页 / 音乐 / 读经计划（今日读经 + 坞）/ 圣经目录 / 创世记 1（坞紧凑档 + 展开 sheet）/ 抽屉，五个 Tab 全部可切。已装到 home 手机（`me.askbible`，先卸载再装，登录态需重登一次）。

**两个实测坑**（别再踩）：
1. `tabViewBottomAccessory { if cond { ... } }` —— 条件写在 modifier **里面**，坞没在放时系统照样留出一条空的 accessory（首页底栏上方多一条空灰胶囊）。条件必须写在 modifier 外面。
2. `\.tabViewBottomAccessoryPlacement` 在底栏上方那档报的是 `.expanded`，但给的高度只有一行，完整 transport 会被裁掉。所以 accessory 里一律用紧凑档，不看 placement。

## 7. 第三轮已落地（2026-09-16，这轮的取舍由 Claude 定，Josh「全部你安排」）

先把三条挂着的选择定了：**底栏保留文字标签**（原生默认、无障碍更好，iOS 26 滚动时系统会自己收拢）；**坞的展开保持现在点开 sheet**（能用，不为纯度去追原生上拉手势）；**安卓 / 网页暂不对齐**（等 iOS 定型再一次性搬，免得来回改两遍）。

| 改了什么 | 为什么 | 文件 |
|---|---|---|
| 章页与目录页的右栏工具（设置 / 搜索 / 书签 / 字号± / 最近）从 5–6 颗常驻钮收成**一颗 ⋯**，点开才展成玻璃簇（`askGlassID` 形变） | 白字带阴影时字能从笔画缝里透出来还能忍；换成玻璃圆钮后是实打实挡住两三行经文（创世记 1 第 2 节「神的灵运行在水面上」被切）。经文是主角，工具不常驻 | `Read/ChapterView.swift`、`Read/CatalogView.swift`、`Theme/AskGlass.swift` |
| 纯控件弹层改玻璃：睡眠定时、确认框 | Glass = Interface。带经文的弹层（节操作 / 串珠 / 章节选择）**故意留纸** | `Shell/TimePickerSheet.swift`、`Shell/ConfirmSheet.swift` |
| 卡片圆角走 `AskCorner.card`（含 `parchmentCard` 默认值） | Corner token 落地 | `Shell/ParchmentBackground.swift` 等 5 处 |
| 划重点条**保持纸**，没有跟着改玻璃 | 它是全 App 唯一「浮层与下层 UIKit 画笔手势共存」的地方（DECISIONS 2026-09-13 Bug 2）。玻璃背景理论上不吃触点，但模拟器里用合成拖拽验证不出真实画笔行为 —— **没验证过就不动**，真机确认后再换 | `Read/HighlightBar.swift` |

**`backgroundExtensionEffect` 评估后不做**：这个 API 的价值在于「内容边缘被系统 UI 裁掉」的场景（iPad 侧栏、顶部大标题栏后面）。本 App 的羊皮页整屏铺满、首页视频也整屏铺满，纸与视频本来就延续到系统 UI 之后，加了看不出差别。为了用 API 而用不写进代码 —— 真需要它的场景是将来上 iPad 分栏，那时再说。

## 8. 第四轮：按 Josh 圈定的参考图重做坞（2026-09-16）

Josh 真机反馈两条：① 章页底部**挡掉太多**（截图里正文与坞之间空出一大片）；② 坞**不是我们看好的那个效果**（附参考图：封面缩略图 + 章名 + 进度 + 倒计时 + 琥珀大播放键 + 下一章）。

| 改了什么 | 文件 |
|---|---|
| 章页底部渐隐 150/104 → **44/0**。150 那版是照自绘底栏调的；换原生 TabView 后底栏与坞的高度由系统计入安全区，正文本来就结束在坞之上，不需要再留一大片 | `Shell/ParchmentFade.swift` |
| 坞紧凑档重做成两行迷你播放器：44pt 圆角封面（借当前自然场景缩略图，章节朗读本身没有封面）+ 章名「创世记 2」+ `0:00 —— -3:38` **倒计时**（参考图是剩余时间，不是总时长）+ 琥珀 48pt 大播放键 + 语速 / 循环 / 下一章 / 搜索 | `Read/PlaybackDock.swift` |
| **放弃 `tabViewBottomAccessory`**，坞改回自己 `safeAreaInset` 铺在系统栏上方的一块玻璃卡 | `Shell/ShellTabBar.swift` |
| 去掉「点中间弹完整 transport」的 sheet —— 两行卡里控件已经齐了，不需要再点开一层 | `AskBibleApp.swift` |

**为什么放弃系统 accessory**：它只给约 48pt 一行，装不下参考图那版两行布局（试过，播放键和进度行都被裁）。改成自己铺之后，iOS 26 与 17–25 走同一条路，也不用为两档高度写两份布局 —— 系统栏仍然是原生的，只有坞是我们的。

## 9. 第五轮：把 tint 拿掉，交回系统渲染（2026-09-16）

Josh：「这些不是我们效果图里的玻璃的样子，我还是要原生的。」

根因很明确：第一轮为了让白图标在明亮照片上读得清，我给玻璃加了一层 tint（暗 0.18 / 浅 0.12）。那层色**挡住了 Liquid Glass 自己的折射与边缘高光**，于是玻璃退化成一块半透明灰板 —— 效果图里那种"背景在玻璃里弯折、边缘有一圈亮线"的质感全没了。

改法：

| 改了什么 | 文件 |
|---|---|
| 去掉 tint。照片 / 视频上的控件用 `Glass.clear`，羊皮纸上的用 `Glass.regular`，都交系统原样渲染 | `Theme/AskGlass.swift` |
| 白图标的对比改由 `askGlassIconShadow()`（单层、黑 0.28 / r3）承担，而不是给整块玻璃着色 | `Home/HomeView.swift` |
| 划重点条改玻璃（Josh 真机确认画笔正常），去掉 `backgroundHitTesting: false` 补丁 | `Read/HighlightBar.swift` |

**教训写在这里**：想让玻璃上的前景更清楚，动前景（图标阴影、字重、颜色），**不要动玻璃**。给玻璃着色等于跟系统抢渲染，结果一定是塑料感。

## 10. 第六轮：玻璃背后要有内容（2026-09-16）

Josh 两轮反馈同一件事：「这 2 个效果还是不一样」「我感觉我们的图不是原生的，是一个底色，而不是玻璃」。

先排除材质问题：`xcrun devicectl device info details` 确认真机是 **iOS 26.6.2**，所以走的确实是 `glassEffect`，而且上一轮已经把 tint 去掉了。**材质没问题。**

真正的原因是**玻璃背后是一片平整的纸**：章页底部当时还有 44pt 渐隐，经文在坞上方就淡完了，玻璃盖在平色上 —— 真玻璃盖在平色上跟一块底色没有区别。效果图里文字是穿到玻璃后面去的，那层弯折与模糊才是「玻璃感」。

| 改了什么 | 文件 |
|---|---|
| 章页底部渐隐 44 → **0**，Tab 页 120 → 60；内容照常滚到玻璃与系统底栏后面（滚动长度仍由 `safeAreaInset` 保证） | `Shell/ParchmentFade.swift` |
| 坞几何按效果图逐项对齐：封面 40、标题 13、时间 11、进度 2、播放键 40（原 48）、循环 19、「下一章」补两行小字标签 | `Read/PlaybackDock.swift` |

**记住这条规律**：Liquid Glass 的观感 = 材质 × 背后内容。要判断玻璃对不对，必须看**有内容穿过它**的状态；对着一片空白纸怎么调都是底色。

## 11. 第七轮：一律 `.clear` + 内建辅助功能诊断（2026-09-16）

Josh：「还是平的，看不出来。」

两手一起做：

1. **材质**：玻璃一律 `Glass.clear`（不再按 tone 分档）。`.regular` 的磨砂在羊皮这种低对比底上等于底色。前景补对比：坞标题 bold、时间 semibold。
2. **排除环境因素**：辅助功能的**「降低透明度」**一旦打开，iOS 会把所有 Liquid Glass 换成不透明平色 —— 症状与「怎么调都是底色」完全一致，而且改代码永远修不好。所以把检测内建进 App：抽屉底部版本号后面会附一行提示（`AskGlassDiagnostics`），正常时不显示。路径：设置 → 辅助功能 → 显示与文字大小 → 降低透明度。

## 12. 第八轮：玻璃终于有折射了（2026-09-16，以模拟器为准调）

Josh：「你可以在虚拟机里看到效果的，我们按虚拟机先实现再说。」+「内页是不是因为下面还多了一层底档住文字，所以看不出玻璃效果，另外图标都比较小，会误点。」

他的判断是对的，而且是两层叠加：

1. **坞用 `safeAreaInset` 挂 → 滚动视图被压小，经文被裁在坞上缘**。玻璃底下只剩空白纸，材质再对也是一块底色。改成 `overlay` + `contentMargins(.bottom, 104, for: .scrollContent)`：content margin 只加长内容、不压小滚动视图，经文照常从坞底下穿过去。
2. **系统的 scroll edge effect 又糊了一层**。`scrollEdgeEffectHidden(true, for: .bottom)` 关掉（封装成 `askNoScrollEdgeBlur()`）。

结果见 `docs/design-concepts/2026-09-16-ios26-round8-glass-refraction.png`：玻璃里能看到「诸水之间要有空气，将水分为上」被压扁弯折，章末滚到底时最后一节完整可读、后面的「第 2 章」卡片在玻璃里透出来。

顺带把触控框修回 ≥44（上一轮照效果图连点击框一起缩了，误点）。**图标小是设计，触控小是 bug。**

**专用模拟器**：`AskBible-Glass`（iPhone 17 Pro / iOS 26.5，UDID `4C1D3CEB-DA49-4605-A675-B7C31022B488`）。原来的 iPhone 14 Pro Max 给别的线程在用，别抢。

**排查玻璃问题的顺序**（照这个来，不要一上来调材质）：① 辅助功能「降低透明度」是否开着（抽屉底部版本号后面会报）② 内容是否被 `safeAreaInset` 裁掉 ③ 系统 scroll edge effect 是否把内容糊掉 ④ 最后才是 `.clear` / `.regular` 档位。

## 13. 第九轮：首页阴影、坞垫底、深色模式（2026-09-16）

| 改了什么 | 文件 |
|---|---|
| 首页去掉顶部暗渐变 + 金句径向暗化；金句改文字阴影 `verseTextShadow()` | `Home/HomeView.swift`、`Theme/ParchmentTheme.swift` |
| 坞第一行垫 0.85 纸色底（按钮行不垫） | `Read/PlaybackDock.swift` |
| 深色模式：去掉锁浅色；`@Environment(\.parchment)` 替 49 处 `Parchment.light`；`parchmentCard` / `ParchmentPinnedBottom` 跟随环境 | 全部羊皮页 |
| 深色下羊皮底纹 `softLight` 0.55 叠深底 | `Shell/ParchmentBackground.swift` |
| ~57 处写死颜色改 `Color(parchment:)`，暗色值集中在 `parchmentDarkMap` | `Theme/ParchmentTheme.swift` + 各页 |
| 暗色板 `humanSpeech` #38486C → #9DB2DE（RN 照抄的错） | `Theme/ParchmentTheme.swift` |

**验证**：专用模拟器 `AskBible-Glass` 切深色（`xcrun simctl ui <UDID> appearance dark`）走过：圣经目录、创世记 1（小标题、「昼」「夜」、坞）、读经计划、探索、首页。浅色走过首页（暗化层确认去掉）。模拟器已切回浅色。

**新页面怎么写**：`@Environment(\.parchment) private var theme`；要写死颜色就用 `Color(parchment: 0x…)` 并在 `parchmentDarkMap` 里补暗色值。**不要再写 `Parchment.light`，也不要写 `Color(rgb:)` 到羊皮页里。**

**还没做的**（下一轮）：划重点条改玻璃（要先在真机上确认画笔不受影响）、Scripture 语义色在老页面里的实际替换（现在只建好了语义名，老页面仍直接引 `canvas` / `ink`）、内层芯片 / 输入框的 10–12pt 圆角是否也收进 token（现在故意留字面值，它们不是 card 语义）、深色模式下音乐页 / 登录页 / 弹层逐个细看（本轮只走了主干五屏）、安卓与网页的视觉语言对齐。

## 4. 待你决定

- **选哪条方向**：推荐 D1 + D2 材质（理由见上）。概念图出来后你挑，挑完我当场把决定写进 `docs/DECISIONS.md` 再动代码。
- **底栏是否降级**：图标 36pt→系统尺寸、中央 60pt FAB 是否改为普通 tab + prominent 处理。这会改变肌肉记忆，属于产品决定不是技术决定。
- **是否换 SF Symbols**：现在是 MaterialIcons 字形，与 RN/安卓/网页共用一套字形表；iOS 单独换 SF Symbols 会让四端图标语言分叉。
- **deployment target 是否抬到 26**：抬了能删掉一半 fallback 代码，代价是 iOS 17–25 用户拿不到新版。我的建议是**不抬**，走上面的两套 renderer。
