# A frame every 0.5 s of a p5-e1 recording (the compositor's own frames), labelled with the time, as one contact sheet; also the largest change between neighbouring frames and any flat (blank) frame.
#   python p5-sheet.py <outDir> <tag> [step=0.5] [cols=10]
import sys, glob, os, re
import numpy as np
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 10
fs = sorted(glob.glob(os.path.join(out, f'screencast-{tag}', 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs]); ts -= ts[0]
small = lambda f: np.asarray(Image.open(f).convert('L').resize((98, 166)), dtype=np.float32)
flat = [(round(ts[i], 2)) for i, f in enumerate(fs) if i > 3 and small(f).std() < 1.0]
print(f'{tag}: {len(fs)} frames over {ts[-1]:.1f}s; flat frames after the first second: {len(flat)} {flat[:6]}')
W, H = 130, 220
ticks = np.arange(0, ts[-1], step)
rows = (len(ticks) + cols - 1) // cols
sh = Image.new('RGB', (W * cols, H * rows), 'white')
for n, t in enumerate(ticks):
    j = max([i for i in range(len(fs)) if ts[i] <= t] or [0])
    im = Image.open(fs[j]).convert('RGB').resize((W, H)); d = ImageDraw.Draw(im); d.rectangle((0, 0, 34, 10), fill=(255, 255, 255)); d.text((2, 0), f'{t:.1f}', fill=(200, 0, 0))
    sh.paste(im, ((n % cols) * W, (n // cols) * H))
sh.save(os.path.join(out, f'sheet-{tag}.jpg'), quality=80); print('sheet', len(ticks), sh.size)
