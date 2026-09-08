"""判断某个图标此刻是不是「亮」（琥珀色选中态）。

日志看不出这件事：原生账本说音乐已经暂停，界面却可能还黄着——Josh 报的
「展示是黄色选中，但是没有声」就是这个形状。只有数屏幕像素能发现。

用法：icon-lit.py <截图 png> <图标中心 x> <图标中心 y> [取样半径]  →  打印 lit / dark
"""

import sys
from PIL import Image

png, x, y = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
# 取样半径随屏幕密度走：同样一个图标在 1440p 上占的像素是 720p 的两倍。
r = int(sys.argv[4]) if len(sys.argv) > 4 else 34
box = Image.open(png).convert("RGB").crop((x - r, y - r, x + r, y + r))
px = box.tobytes()
# 选中色是琥珀 #FFB101。只数够黄够亮的像素，背景的湖水与天空落不进这个窗口。
lit = sum(
    1
    for rr, gg, bb in zip(px[0::3], px[1::3], px[2::3])
    if rr > 200 and 130 < gg < 210 and bb < 90
)
# 阈值按取样面积缩放，换机型不用重调。
threshold = max(40, int(120 * (r / 34) ** 2 * 0.35))
print("lit" if lit > threshold else "dark")
