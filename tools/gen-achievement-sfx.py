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

# --- 1) +XP：很轻的一声「点」。这个会频繁响，必须短、必须不抢 ---
t = np.linspace(0, 0.09, int(SR * 0.09), endpoint=False)
tick = (np.sin(2 * np.pi * 1760 * t) * 0.6 + np.sin(2 * np.pi * 2637 * t) * 0.25) * np.exp(-t / 0.018)
a = int(SR * 0.001); tick[:a] *= np.linspace(0, 1, a)
write("xp.wav", tick, peak=0.55)   # 峰值压到 .55：它只是个陪衬

# --- 2) 勋章 / 印章：单声钟，A4 440 ---
write("earn.wav", bell(440, 1.10), peak=0.82)

# --- 3) 升级：三声上行 A4–C#5–E5（大三和弦分解），最后一声留长 ---
dur = 1.9
out = np.zeros(int(SR * dur))
for i, (f, off, amp, d) in enumerate([(440, 0.00, 0.78, 0.55),
                                      (554.37, 0.13, 0.86, 0.55),
                                      (659.25, 0.26, 1.00, 1.60)]):
    b = bell(f, d, amp)
    s = int(SR * off)
    out[s:s + len(b)] += b[: len(out) - s]
write("levelup.wav", out, peak=0.92)
