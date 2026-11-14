---
name: bible-tts
description: >-
  用本机 Kokoro（英文）/ VoxCPM2（中文）生成圣经经文语音（金句单句、整章朗读）。
  中文金句现役音色是"Kokoro zm_yunjian 音色 → VoxCPM2 克隆（沉稳克制指令）→ atempo 0.88 放慢"（2026-09-10 v2 定稿），参考音与参数在 data/tts/golden-verse-voice/。
  涉及金句音频、整章朗读、语音对比试听、golden-verse 相关生成任务时使用。简写：bible-tts。
---

# Bible TTS（本机语音合成）

金句/整章的具体文案怎么写、上传去哪个 R2 目录，见 `docs/mobile-golden-verse-audio.md`；
这份技能只管**怎么把文字变成听感对的音频**。

## 两套引擎分工（已定稿，不要重新选型）

| 语言 | 引擎 | 理由 |
|------|------|------|
| 中文 | **VoxCPM2 克隆 Kokoro `zm_yunjian` 音色**（v2，见下） | Kokoro 给稳定音色锚点，VoxCPM2 给克制的自然抑扬；单用任一个都被 Josh 否了（一个太平、一个情绪太多） |
| 英文 | **Kokoro**（`prince-canuma/Kokoro-82M`，`am_michael`） | Kokoro 以英文为核心训练，`am_michael` 是预设里最接近的成熟男声；速度是 VoxCPM2 的 20-30 倍 |

同一批文案分别用两个引擎跑过盲听对比，中文 VoxCPM2 明显更贴近"成熟磁性播音腔"目标，英文两边接近但 Kokoro 更快，故按上表分工，不要两个语言都用同一个引擎图省事。

## 环境（两个引擎要分开装，别混）

**VoxCPM2**：用任何已装了 `voxcpm` pip 包 + torch(MPS) 的 venv 即可，本机现成的是
`/Users/joshua/Desktop/APP/02JoshuaTools/.venv`（2026-09-10 用 python 3.12 重建）。
⚠️ 这两个 venv 都在 `~/bin/clean_build_artifacts.sh` 的"3 天沉寂就删"范围内，开工前先确认还在，
不在就按下面命令重装（模型权重在 `~/.cache/huggingface` 不会被清）。

```bash
.venv/bin/pip install voxcpm soundfile   # 如果还没装
```

**Kokoro**：必须用 **python 3.12**（`brew install python@3.12`），python 3.14 下 `misaki[en]` 依赖的
spacy/blis 编译不过。

```bash
python3.12 -m venv .venv-mlx
.venv-mlx/bin/pip install mlx-audio "misaki[en,zh]" num2words
brew install espeak-ng   # 提供真实的 espeak-ng-data
```

⚠️ **已知坑**：`espeakng-loader` 这个 wheel 里打包的 `espeak-ng-data` 路径是它 CI 构建机上的路径
（`/Users/runner/work/espeakng-loader/...`），本机不存在，英文/中文 g2p 都会在生成时报
`Error processing file '.../phontab': No such file or directory`。跑 Kokoro 前必须先 monkeypatch：

```python
import espeakng_loader
espeakng_loader.get_data_path = lambda: "/opt/homebrew/Cellar/espeak-ng/1.52.0/share/espeak-ng-data"
# 上面这行必须在 `import mlx_audio.tts.generate` 之前执行，
# 否则 misaki.espeak 会先用坏路径把 EspeakWrapper 初始化掉。
import mlx_audio.tts.generate as g
```

（`espeak-ng` 的实际版本号以 `brew list espeak-ng` 为准，不一定永远是 1.52.0。）

## 中文金句音色（2026-09-10 定稿，v2）：Kokoro 音色 → VoxCPM2 克隆 → atempo 放慢

**这一节是现役方案，下面"v1 音色设计"一节只留作历史。** 参考音、指令、参数都固化在
`data/tts/golden-verse-voice/config.json`（参考音 `ref-zm_yunjian-ISA-41-10.wav` 在同目录，
放在仓库里是为了不被 `~/bin/clean_build_artifacts.sh` 当临时文件清掉）。

- **参考音**：Kokoro 内置中文男声 `zm_yunjian`（`lang_code="z"`, `speed=0.8`）念 ISA.41.10 的那句。
  Kokoro 是确定性模型，参考音固定，4242 句克隆出来才是同一个人、同一个音区。
- **克隆指令**：`播音级男声，沉稳克制，语调平稳略有起伏，庄重温和，语速稍慢`，`cfg_value=2.0`，`inference_timesteps=10`，
  `reference_wav_path=` 参考音（不是 prompt 续读模式）。
- **语速**：VoxCPM2 **对语速指令基本不响应**（"语速偏慢"/换更慢参考音都没变慢），语速只能后期
  `ffmpeg -filter:a atempo=0.88`（放慢 12%，Josh 在 8%/12% 里选的 12%）。转 mp3 时一并做。
- 实测约 9-14 秒/句（MPS，float32），4242 句约 12 小时；Whisper 回读别和生成同时跑，会抢 GPU 让两边都变慢。

为什么这样选（盲听 13 个候选后 Josh 的反馈链）：VoxCPM2 纯描述设计出来的声音"情绪太多"、且每次设计的音色不同，
句间音高会漂；Kokoro 内置音色"太平了，没有情感"；折中就是拿 Kokoro 的音色当锚、让 VoxCPM2 给克制的抑扬。
试过并淘汰的：VoxCPM2 描述设计 ×6（含 v1 长者版、新闻主播、纪录片解说、"无情绪念稿"），Kokoro 4 个中文男声直出，
VoxCPM2 克隆 yunjian 的"无指令"版和"prompt 续读"版。

工具脚本在 `tmp/golden-verse-voice-retune/`（临时目录，可能被清；核心逻辑很短，丢了按上面参数重写即可）：
`prep_lines.py`（chunk → 口播文案，含中文数字与句末标点修正）、`produce_all.py`（可断点续跑）、
`verify_whisper.py`（mlx-whisper large-v3-turbo 逐条回读，汉字数比 <0.85 或相似度 <0.7 判 BAD）。

⚠️ zsh 坑：不要用 `LINES=...` 当环境变量名传路径，`LINES` 是 zsh 的终端行数变量，会报 `division by zero`。

## （历史）v1 中文音色：VoxCPM2 音色设计 + 声音克隆

**不要每次都重新设计音色** —— 音色设计是随机的，同一句描述每次生成的具体音色都不同。
正确流程是「设计一次参考音色 → 之后所有句子都用声音克隆套用这个参考音色」，
这样一整章/一整个金句池里的音色才是同一个人。

1. 生成参考音色（只需跑一次，存下 `ref.wav` 长期复用）：

   ```bash
   voxcpm design \
     --text "你不要害怕，因为我与你同在。" \
     --control "成熟男性长者，年过六旬，声音低沉浑厚、磁性有质感，字正腔圆的中央台播音腔，语速沉稳适中，情绪庄重温和，充满智慧和权威感" \
     --output ref.wav --device auto
   ```

   这段 `--control` 描述是听感确认过的定稿版本（"v1"）。中途试过更"平缓"和更"轻庄重"的两版，
   用户都反馈方向不对，最后明确要求"回到第一版"——**不要在没有新反馈的情况下擅自调整这段描述**。

2. 用这个参考音色批量克隆生成正文（`--input` 每行一句，产出 `output_001.wav, output_002.wav, ...`）：

   ```bash
   voxcpm batch \
     --input lines.txt --output-dir out/ \
     --reference-audio ref.wav \
     --control "语速沉稳适中偏慢，庄重温和，字正腔圆" \
     --device auto
   ```

   单句一次 `voxcpm clone`（同样传 `--reference-audio` + 这段 `--control`）效果一样，批量脚本见下。

## 英文音色：Kokoro 预设

```python
g.generate_audio(
    text=text, model=model,          # model = g.load_model("prince-canuma/Kokoro-82M")，只加载一次复用
    voice="am_michael", lang_code="a", speed=0.92,
    output_path=out_dir, file_prefix=f"verse_{i:02d}", verbose=False,
)
```

`speed=0.92` 是唯一手动调过的参数（比默认语速稍慢，配合播音腔感觉）。

## 整章朗读：停顿是关键，别一次性长文本生成

**踩过的坑**：把一整章文字拼成一段话丢给 VoxCPM2 一次性生成，出来的音频**没有停顿**——
听感是从头到尾语速均匀地念下去，没有逐节呼吸感，用户反馈"缺少停顿"。

**正确做法**：每一节（含章节标题）单独生成一个音频片段，再用 ffmpeg 插入静音后拼接：

```bash
# 章节标题后停顿 1.3s，节与节之间停顿 1.1s ——这两个数字是听过好几版才定下来的，
# 第一版 0.8s/0.6s 被反馈"还是太紧"，加长到 1.3s/1.1s 才通过。
ffmpeg -f lavfi -i "anullsrc=r=48000:cl=mono" -t 1.3 silence_title.wav
ffmpeg -f lavfi -i "anullsrc=r=48000:cl=mono" -t 1.1 silence_verse.wav

# list.txt: title.wav, silence_title.wav, verse1.wav, silence_verse.wav, verse2.wav, silence_verse.wav, ...
ffmpeg -f concat -safe 0 -i list.txt -ar 24000 -ac 1 -codec:a libmp3lame -b:a 32k chapter.mp3
```

标题行文本例："诗篇第一篇。"／"罗马书第五章。"（书卷名 + 中文数字 + 篇/章，末尾句号）。

## 文案准备

- **章节数字要写成中文/英文数字，不要用阿拉伯数字**（"三章五节"而不是"3章5节"，
  "Proverbs three, verse five" 而不是 "Proverbs 3:5"）——阿拉伯数字+冒号格式在两个引擎上
  都有读错/读成时间的风险，实测拼出来的中文数字（十一、二十一、一百一十九……标准读法）
  和英文数字都稳定可靠。转换算法很短，两个引擎各写一个小函数即可（1-176 覆盖全经章节/节数范围）。
- **正文优先从 `public/data/home-prayer-pools/*/chunk-*.json` 的 `byTranslationId.{译本}.lines` 取**
  （join 空格），不要直接查 sqlite 原文——sqlite 原文里有两类坑，chunk 数据已经处理干净：
  - `〔……〕` 是译者夹注（"或作：……"之类），会被读成很怪的插入语，chunk 里已经去掉了；
  - 少数节（如 ACT.4.30）sqlite 原文是"并于上节"占位符（该节文字并到了上一节），chunk 数据
    已经是解析好的正确文字。
  - 反过来，全角 `（）`/`［］` 里的内容（诗篇标题"（大卫的诗，交与伶长）"、"（细拉）"这类）
    是正文的一部分，**不要**当注释删掉。
  - 如果是不在金句池里的任意整章（比如临时试听某一章），直接查 `data/bible/sqlite/{译本}.sqlite`
    的 `verse` 表，但要额外用正则 `〔[^〕]*〕` 兜底清一遍译者夹注。
- 输出统一 32kbps / 单声道 / 24kHz mp3（`ffmpeg -ac 1 -ar 24000 -codec:a libmp3lame -b:a 32k`），
  文件名 `{bookId}-{chapter}-{verse}-32kbps.mp3`，跟 `lib/bible/golden-verse-audio.ts` 的
  `buildGoldenVerseAudioFilename` 对齐，这样能直接同名覆盖到 `public/audio/golden-verses(-web-en)/`
  替换生产文件，不用改上传脚本。

## 批量生成的量级参考（实测，2026-09 用这套配置测出来的）

- VoxCPM2 中文：约 14-18 秒/句（含模型已加载），4242 句（金句池全量）约 14-17 小时。
- Kokoro 英文：约 0.5-0.7 秒/句，4242 句约 40-50 分钟。
- 全经 31,100 节，按上面速度中文约 5 天、英文约 6 小时——中文全经生成前务必先抽样多卷
  （不只是金句池那种"高频精选"短句，要覆盖家谱/律法这类生僻长句）确认质量再决定要不要跑全量。

## 上传替换生产文件

上传脚本、R2 目录结构见 `docs/mobile-golden-verse-audio.md`。踩过的坑：

- `scripts/upload-golden-verse-audio-r2-fast.mjs` 默认**跳过已存在的 key**，不会覆盖——
  要替换生产内容加 `R2_FORCE=1`（无条件 PUT），`R2_ONLY_PACK=golden-verses` 只推中文包。
  上传前先 `npx wrangler whoami` 让 wrangler 自己刷新 OAuth token。
- Wrangler 的 R2 OAuth token 大概 1 小时过期，长跑的生成/上传任务要在每次上传前检查
  `~/.wrangler/config/default.toml` 的 `expiration_time` 并按需刷新（refresh_token 是一次性轮换的，
  刷新后要把新的 access_token **和** refresh_token 都写回配置文件，不能只读不写，否则下次刷新会
  因为旧 refresh_token 失效而彻底断掉，只能 `npx wrangler login` 重新交互式登录）。

## 评估过 Qwen3-TTS，结论是中文金句维持 VoxCPM2，别再重复选型（2026-09-05）

动机是速度：Qwen3-TTS（`mlx-community/Qwen3-TTS-12Hz-1.7B-*`，走 `~/.codex/skills/local-tts/scripts/tts_qwen3.py`，
批 16 并行）中文约 2 秒/句，比 VoxCPM2 的 14-18 秒/句快一个数量级。三轮盲听对比后仍然**不换**，
用户定的是「中文金句按目前线上（VoxCPM2）就好」。已试过的都记在这里，不要再跑一遍：

- **Qwen3 内置音色全部出局。** CustomVoice 的 `spk_id` 一共 9 个：`serena` `vivian`（女）、
  `ono_anna` `sohee`（日/韩女）、`uncle_fu` `ryan` `aiden` `eric` `dylan`（男）。五个男声用中文
  （`lang_code="chinese"`）念经文全部盲听落选：第一轮 `uncle_fu` 对现役 10 句 0 票，第二轮
  `ryan`/`aiden`/`eric`/`dylan` 对克隆版 3 句 0 票。`eric` 咬字最糊（Whisper 把"马太福音"听成"麻台福音"），
  `ryan` 语速最沉但仍落选。**内置音色给不出"成熟磁性播音级长者"，这条路是死的。**
- **克隆能保住音色，但会吞句尾。** 用现役成品（如 `public/audio/golden-verses/PSA-100-1-32kbps.mp3`
  转 24k 单声道 wav）当参考音走 Base 模型克隆，音色盲听赢过全部内置音色；但 20 条里有 2 条
  **漏掉整个句尾出处**（只念经文不念"诗篇四十六章一节"）。漏念时长明显偏短却远低于超长阈值，
  **时长检测抓不到，只有 Whisper 逐条回读能发现**。10% 漏念率是不换的主因。
- **`tts_qwen3.py` 的超长阈值对中文经文误判严重。** `max_seconds = 0.9 + 0.55×字数/2` 是按正常语速定的，
  而经文要求"沉稳略慢"（实测 0.34-0.37 秒/字），20 条里误判 6 条。被误判的句子重试后
  **会去掉 instruct 并取最短那条**，等于悄悄变成"无语气指令 + 语速偏快"的版本，且不报错。
  中文改成 `0.9 + 0.5×字数` 后 12/12 零重试，速度还快 40%。**若将来真要用 Qwen3 跑中文，先改这个系数。**
- **Qwen3 语速天生比 VoxCPM2 快约 11%**，`tempo` 要从 0.94 降到约 0.85 才对得上现役节奏
  （但 0.85 那版反而出现漏念，`tempo` 不是越低越好）。
- **仍然可以考虑 Qwen3 的场景**：整本圣经逐节朗读（3.1 万条，VoxCPM2 要 5 天、Qwen3 约 7 小时
  加逐条回读校验）。真跑的话流水线必须是「生成 → 逐条 Whisper 回读比对汉字数（低于原文 85% 判漏念）
  → 重跑 → 复检」，不能只抽样。
