# scan a CDP screencast (s-NNNN-<ts>.jpg): blank / white / black frames, hard cuts (needles), frame gaps
# usage: python phone-spike-scan.py <dir>
import sys, glob, os, re
import numpy as np
from PIL import Image
d = sys.argv[1]
fs = sorted(glob.glob(os.path.join(d, 's-*.jpg')))
ts = [float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs]
prev = None; e = []; blank = []; lum = []
for i, f in enumerate(fs):
    a = np.asarray(Image.open(f).convert('L').resize((195, 433)), dtype=np.float32)
    m, s = float(a.mean()), float(a.std()); lum.append(m)
    if s < 3 or m < 40 or m > 250: blank.append((i, round(ts[i] - ts[0], 3), round(m, 1), round(s, 1)))
    if prev is not None: e.append(float(np.abs(a - prev).mean()))
    prev = a
e = np.array(e) if e else np.zeros(1)
gaps = np.diff(ts) * 1000 if len(ts) > 1 else np.zeros(1)
print('frames', len(fs), 'span %.2fs' % (ts[-1] - ts[0]) if len(ts) > 1 else '', 'luma min %.1f max %.1f' % (min(lum), max(lum)))
print('blank/white/black frames:', len(blank), blank[:8])
print('frame gap ms: median %.1f p95 %.1f max %.1f' % (np.median(gaps), np.percentile(gaps, 95), gaps.max()))
print('motion energy: median(nonzero) %.2f max %.2f' % (np.median(e[e > 0.05]) if (e > 0.05).any() else 0, e.max()))
# screencast frames arrive unevenly (duplicates, gaps): judge change per millisecond, against the nearest changing neighbours
dt = np.maximum(np.diff(ts) * 1000, 1.0) if len(ts) > 1 else np.ones(1)
r = e / dt[:len(e)]
needles = []
for i in range(len(r)):
    near = [r[j] for j in range(max(0, i - 4), min(len(r), i + 5)) if j != i and r[j] > 0.02]
    if len(near) >= 3 and e[i] > 4 and r[i] > 3 * float(np.median(near)): needles.append((i + 1, round(ts[i + 1] - ts[0], 3), round(float(e[i]), 1), round(float(r[i]), 2), round(float(np.median(near)), 2)))
print('needles (change per ms > 3x the median of its changing neighbours):', len(needles), needles[:8])
print('largest changes:', ', '.join('t%.2fs=%.1f' % (ts[i + 1] - ts[0], e[i]) for i in np.argsort(e)[-6:][::-1]))
