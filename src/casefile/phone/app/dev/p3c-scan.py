# Scan a P3c recording (CDP screencast: s-NNNN-<ts>.jpg) against the flows' own timeline (flows.json): blank / white / black frames, hard cuts (needles),
# frame gaps, per scenario. The door -> intro match cut is the one cut the design has; it is reported on its own.
# usage: python p3c-scan.py <screencast dir> <flows.json> [out.txt]
import sys, glob, os, re, json
import numpy as np
from PIL import Image

d, fj = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else None
F = json.load(open(fj, encoding='utf-8'))
fs = sorted(glob.glob(os.path.join(d, 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs])
prev = None; e = []; blank = []; lum = []
for i, f in enumerate(fs):
    a = np.asarray(Image.open(f).convert('L').resize((195, 332)), dtype=np.float32)
    m, s = float(a.mean()), float(a.std()); lum.append(m)
    if s < 3 or m < 40 or m > 252: blank.append(i)
    if prev is not None: e.append(float(np.abs(a - prev).mean()))
    prev = a
e = np.array(e); lum = np.array(lum)
dt = np.maximum(np.diff(ts) * 1000, 1.0)
r = e / dt
# needles: change per ms much larger than the median of the changing frames around it
needles = []
for i in range(len(r)):
    near = [r[j] for j in range(max(0, i - 4), min(len(r), i + 5)) if j != i and r[j] > 0.02]
    if len(near) >= 3 and e[i] > 4 and r[i] > 3 * float(np.median(near)): needles.append(i + 1)
t0 = F['t0'] / 1000.0
steps = F['steps']
# windows between consecutive named steps (a step's t is seconds since the script began)
wins = [(steps[k]['name'], t0 + steps[k]['t'], t0 + steps[k + 1]['t'] if k + 1 < len(steps) else ts[-1]) for k in range(len(steps))]
lines = []
P = lambda s: (lines.append(s), print(s))
P(f'frames {len(fs)}  span {ts[-1] - ts[0]:.1f}s  luma {lum.min():.1f}..{lum.max():.1f}  blank/white/black frames: {len(blank)} {blank[:8]}')
gaps = np.diff(ts) * 1000
P(f'frame gap ms: median {np.median(gaps):.1f}  p95 {np.percentile(gaps, 95):.1f}  max {gaps.max():.1f}')
P(f'needles overall: {len(needles)}')
cut = next((w for w in wins if w[0] == 'intro'), None)
P('')
P('per scenario (between the script\'s own marks): frames / blank / needles / the largest frame-to-frame change (energy 0-255) and when')
for name, a, b in wins:
    idx = [i for i in range(len(ts)) if a <= ts[i] < b]
    if len(idx) < 2: continue
    bl = [i for i in idx if i in set(blank)]
    nd = [i for i in needles if i in set(idx)]
    en = [(e[i - 1], i) for i in idx if i >= 1 and i - 1 < len(e)]
    big = max(en) if en else (0, 0)
    P(f'  {name:34s} {len(idx):4d}  blank {len(bl)}  needles {len(nd)}  max {big[0]:5.1f} at +{ts[big[1]] - a:.2f}s of the step')
if cut:
    near = [i for i in needles if abs(ts[i] - cut[1]) < 1.5]
    P('')
    P(f'the door -> intro match cut (the design\'s one cut) is within 1.5 s of the intro mark: needles there: {len(near)} {[round(float(ts[i] - cut[1]), 2) for i in near]}')
    other = [i for i in needles if abs(ts[i] - cut[1]) >= 1.5]
    P(f'needles elsewhere: {len(other)}  at {[round(float(ts[i] - ts[0]), 2) for i in other][:20]}')
if out: open(out, 'w', encoding='utf-8').write('\n'.join(lines))
