"""
AskBible 成就音效合成。

设计取向：羊皮卷 / 修道院的语气，用「被敲响的金属」而不是游戏的电子 ding。
做法是加法合成——一组**非谐波**分音（真实钟体的分音不是整数倍，这正是它听起来
像钟而不像管风琴的原因）+ 指数衰减包络，再加一点极短的起音噪声当作「棒击」。
"""
import numpy as np, wave

SR = 44100

def write(path, x, peak=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    # 末尾 8ms 淡出，避免爆音
    n = int(SR * 0.008)
    x[-n:] *= np.linspace(1, 0, n)
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print(path, f"{len(x)/SR:.2f}s")

def room(x, wet=0.18, rt=0.9):
    """
    一点点房间感。干声合成出来的钟「太近」，听着像合成器；
    卷一个很短的合成脉冲响应之后就「在一个地方」了 —— 这是廉价合成音最大的破绽。
    IR 用指数衰减噪声，够用且不引入依赖。
    """
    n = int(SR * rt)
    ir = np.random.default_rng(3).normal(0, 1, n) * np.exp(-np.linspace(0, 7, n))
    ir[0] = 1.0
    wetsig = np.convolve(x, ir)[: len(x)]
    wetsig /= np.max(np.abs(wetsig)) + 1e-9
    return x * (1 - wet) + wetsig * np.max(np.abs(x)) * wet


def bell(f0, dur, amp=1.0, strike=0.35):
    """非谐波分音的钟。比值取自实测钟体（hum / prime / tierce / quint / nominal）。"""
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    ratios = [0.5, 1.0, 1.19, 1.5, 2.0, 2.5, 3.0]
    gains  = [0.30, 1.00, 0.55, 0.32, 0.22, 0.10, 0.06]
    # 高分音衰减得快，低分音留得久 —— 钟声「亮起来再暗下去」就是这么来的
    decays = [1.2, 1.0, 0.55, 0.45, 0.30, 0.22, 0.16]
    x = np.zeros_like(t)
    for r, g, d in zip(ratios, gains, decays):
        x += g * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t / (dur * d * 0.42))
    # 棒击：2ms 噪声，给一点「敲」的质感
    k = int(SR * 0.002)
    x[:k] += np.random.default_rng(7).normal(0, strike, k) * np.exp(-np.linspace(0, 6, k))
    # 1.5ms 起音斜坡，防 click
    a = int(SR * 0.0015)
    x[:a] *= np.linspace(0, 1, a)
    return x * amp

# --- 1) +XP：木头 / 纸的一记轻叩。这个会频繁响，必须短、必须不抢 ---
# 原来是 1760+2637Hz 两个正弦，太「电子」：高频正弦在连续几十次之后非常累耳。
# 改成「噪声激励 + 低频共振」——真实的叩击就是宽带激励打进一个有共振的物体，
# 所以听起来像敲在木头/纸面上，而不是一声 beep。
rng = np.random.default_rng(11)
dur = 0.07
t = np.linspace(0, dur, int(SR * dur), endpoint=False)
exc = rng.normal(0, 1, len(t)) * np.exp(-t / 0.004)      # 4ms 的激励，极短
tap = np.zeros_like(t)
for f, g, d in [(520, 1.00, 0.020), (880, 0.42, 0.012), (1450, 0.16, 0.007)]:
    # 每个共振模态：用激励驱动一个衰减正弦（简化的模态合成）
    tap += g * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
tap = tap * 0.85 + exc * 0.25
a = int(SR * 0.0008); tap[:a] *= np.linspace(0, 1, a)
write("xp.wav", tap, peak=0.55)   # 峰值压到 .55；播放音量另在各端压到 0.34

# --- 1.5) 读完一章：木与钟之间的一记小钵 ---
# GPT 的判断（2026-09-20）：「我读完这一章了」比「我获得了 200 XP」重要得多，
# 这应该是全 App 最完整的一次反馈。原来整章完成响的是那记木叩，太轻了，配不上。
# 所以单做一个音：比木叩有余韵、比勋章钟收得快 —— 一记小钵，不抢勋章的庄重。
bowl = bell(330, 0.55, strike=0.22)
write("chapter.wav", room(bowl, wet=0.14, rt=0.7), peak=0.72)

# --- 2) 勋章 / 印章：单声钟，A4 440 ---
write("earn.wav", room(bell(440, 1.10)), peak=0.82)

# --- 3) 升级：三声上行 A4–C#5–E5（大三和弦分解），最后一声留长 ---
dur = 1.9
out = np.zeros(int(SR * dur))
for i, (f, off, amp, d) in enumerate([(440, 0.00, 0.78, 0.55),
                                      (554.37, 0.13, 0.86, 0.55),
                                      (659.25, 0.26, 1.00, 1.60)]):
    b = bell(f, d, amp)
    s = int(SR * off)
    out[s:s + len(b)] += b[: len(out) - s]
write("levelup.wav", room(out, wet=0.22, rt=1.3), peak=0.92)
