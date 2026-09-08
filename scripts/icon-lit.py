"""判断某个图标此刻是不是「亮」（琥珀色选中态）。

日志看不出这件事：原生账本说音乐已经暂停，界面却可能还黄着——Josh 报的
「展示是黄色选中，但是没有声」就是这个形状。只有数屏幕像素能发现。

用法：icon-lit.py <截图 png> <图标中心 x> <图标中心 y>  →  打印 lit / dark
"""

import sys
from PIL import Image

png, x, y = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
box = Image.open(png).convert("RGB").crop((x - 34, y - 34, x + 34, y + 34))
px = box.tobytes()
# 选中色是琥珀 #FFB101。只数够黄够亮的像素，背景的湖水与天空落不进这个窗口。
lit = sum(
    1
    for r, g, b in zip(px[0::3], px[1::3], px[2::3])
    if r > 200 and 130 < g < 210 and b < 90
)
print("lit" if lit > 120 else "dark")
