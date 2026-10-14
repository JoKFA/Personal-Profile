# The name around the entry page's first paint (a slow network), in 0.05 s steps: the top-left of the compositor frame at each step, stacked, so that
# the page painting around the name can be seen not to move it. Needs a run of run.mjs and its scan (result-<tag>.json carries firstPaintMs).
#   python strip_first.py <outDir> <tag> [before=0.5] [after=0.6] [step=0.05]
import sys, glob, os, re, json
import numpy as np
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
pre = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
post = float(sys.argv[4]) if len(sys.argv) > 4 else 0.6
step = float(sys.argv[5]) if len(sys.argv) > 5 else 0.05
res = json.load(open(os.path.join(out, f'result-{tag}.json')))
fs = sorted(glob.glob(os.path.join(out, f'screencast-{tag}', 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs]) * 1000 - res['timeOrigin']
fp = res['firstPaintMs']
rows = []
for t in np.arange(fp - pre * 1000, fp + post * 1000 + 1, step * 1000):
    j = max([i for i in range(len(fs)) if ts[i] <= t] or [0])
    im = Image.open(fs[j]).convert('RGB'); W, H = im.size
    c = im.crop((0, 0, W, int(H * 0.115)))
    d = ImageDraw.Draw(c); d.rectangle((c.width - 190, 0, c.width, 11), fill=(255, 255, 255))
    d.text((c.width - 188, 0), f'{(t - fp) / 1000:+.2f}s (frame {ts[j] / 1000:.2f}s)' + (' FIRST PAINT' if abs(t - fp) < step * 500 else ''), fill=(200, 0, 0))
    rows.append(c)
sh = Image.new('RGB', (rows[0].width, sum(r.height + 2 for r in rows)), (150, 150, 150)); y = 0
for r in rows: sh.paste(r, (0, y)); y += r.height + 2
sh.save(os.path.join(out, f'strip-name-firstpaint-{tag}.png')); print(len(rows), sh.size, 'first paint at %.2fs' % (fp / 1000))
