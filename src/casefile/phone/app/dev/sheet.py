# contact sheet: python sheet.py <dir> <suffix a|b> <out.jpg> [cols] [scale]
import sys, glob, os
from PIL import Image, ImageDraw
d, suf, out = sys.argv[1:4]; cols = int(sys.argv[4]) if len(sys.argv) > 4 else 7; sc = float(sys.argv[5]) if len(sys.argv) > 5 else 0.34
fs = sorted(glob.glob(os.path.join(d, f'*-{suf}.png')))
ims = [(os.path.basename(f)[:-6], Image.open(f).convert('RGB')) for f in fs]
w, h = ims[0][1].size; tw, th = int(w * sc), int(h * sc)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + 22) + 6), (40, 40, 40))
g = ImageDraw.Draw(S)
for i, (n, im) in enumerate(ims):
    x, y = 6 + (i % cols) * (tw + 6), 6 + (i // cols) * (th + 22)
    g.text((x, y), n, fill=(255, 255, 255)); S.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 14))
S.save(out, quality=88)
print(out, S.size)
