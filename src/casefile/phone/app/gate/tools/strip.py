# The name at the hand-over, in 0.05 s steps: the top-left of every step's compositor frame, stacked. A run of run.mjs made with --sc=2.
#   python strip.py <outDir> <tag> [from_s_before_seal=0.15] [to_s_after_gate_gone=0.45] [step=0.05]
import sys, glob, os, re, json
import numpy as np
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
pre = float(sys.argv[3]) if len(sys.argv) > 3 else 0.15
post = float(sys.argv[4]) if len(sys.argv) > 4 else 0.45
step = float(sys.argv[5]) if len(sys.argv) > 5 else 0.05
res = json.load(open(os.path.join(out, f'result-{tag}.json')))
fs = sorted(glob.glob(os.path.join(out, f'screencast-{tag}', 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs]) * 1000 - res['timeOrigin']
E = res['entry']
def strip(t0, t1, name, crop=(0, 0, 1.0, 0.115)):
    ticks = np.arange(t0, t1 + 1, step * 1000)
    rows = []
    for t in ticks:
        j = max([i for i in range(len(fs)) if ts[i] <= t] or [0])
        im = Image.open(fs[j]).convert('RGB'); W, H = im.size
        c = im.crop((0, 0, int(W * crop[2]), int(H * crop[3])))
        d = ImageDraw.Draw(c); d.rectangle((c.width - 150, 0, c.width, 11), fill=(255, 255, 255))
        mark = 'SEAL' if abs(t - E['sealedAt']) < step * 500 else 'FIRST FRAME' if abs(t - E['firstFrameAt']) < step * 500 else 'GATE GONE' if abs(t - E['gateGoneAt']) < step * 500 else ''
        d.text((c.width - 148, 0), f'{(t - E["sealedAt"]) / 1000:+.2f}s {mark}', fill=(200, 0, 0))
        rows.append(c)
    sh = Image.new('RGB', (rows[0].width, sum(r.height + 2 for r in rows)), (150, 150, 150)); y = 0
    for r in rows: sh.paste(r, (0, y)); y += r.height + 2
    sh.save(os.path.join(out, name)); print(name, len(rows), sh.size)
strip(E['sealedAt'] - pre * 1000, E['gateGoneAt'] + post * 1000, f'strip-name-seal-{tag}.png')
strip(E['coverAt'] - 150, E['coverAt'] + 650, f'strip-name-rise-{tag}.png')
print('seal %.3f first frame %.3f gate gone %.3f cover %.3f' % (E['sealedAt'] / 1000, E['firstFrameAt'] / 1000, E['gateGoneAt'] / 1000, E['coverAt'] / 1000))
