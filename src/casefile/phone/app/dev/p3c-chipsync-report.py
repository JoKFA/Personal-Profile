# Report on the samples p3c-chipsync.py wrote (the pip-to-anchor fit at every quarter frame around the picture's frame).
# A sample is "within a frame" when the pips fit the baked anchors, within TOL px, at some j in [i - 0.5, i + 1.5] (the picture's frame i, the page layer's designed
# half-frame lead, one frame either side). The test asks whether such a fit exists, so it does not depend on locating the best j among look-alike ones.
# usage: python p3c-chipsync-report.py <samples.json> <out.txt> [TOL px = 1.5]
import sys, json, collections
import numpy as np

src, out = sys.argv[1], sys.argv[2]; TOL = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
R = json.load(open(src))
lines = []
P = lambda t: (lines.append(t), print(t))
P(f'{len(R)} screencast frames with pips and a recognised picture')
sel = [r for r in R if 5 <= r['i'] and r['sharp'] >= 1.0]          # the picture says which frame it is (frames 3 away look clearly worse)
P(f'  picture frame unambiguous: {len(sel)}')
ok = []; bad = []; best_d = []
for r in sel:
    js = np.array(r['js']); c = np.array(r['cost']); i = r['i']
    w = (js >= i - 0.5 - 1e-9) & (js <= i + 1.5 + 1e-9)
    (ok if c[w].min() <= TOL else bad).append(r)
    if c.min() <= TOL: best_d.append(js[int(np.argmin(c))] - i)
P(f'within one frame (a fit of the pips to the anchors within {TOL} px exists at some j in [i-0.5, i+1.5]): {len(ok)} of {len(sel)}')
P(f'no such fit: {len(bad)}')
d = np.array(best_d)
vals, cnt = np.unique(np.round(d * 4) / 4, return_counts=True)
P('where the best fit lies, j - i to the quarter frame (' + str(len(d)) + ' samples): ' + str(dict(zip(map(float, vals), map(int, cnt)))))
P(f'  mean {d.mean():+.2f} median {np.median(d):+.2f}   (the page layer leads by half a frame on purpose)')
P(f'  residual at the designed j = i + 0.5: median {np.median([min(r["cost"][int(np.argmin(abs(np.array(r["js"]) - r["i"] - 0.5)))], 99) for r in sel]):.2f} px')
byst = collections.Counter(r['k'] for r in bad)
P(f'failures by station: {dict(byst)}; by pips drawn: {dict(collections.Counter(r["pips"] for r in bad))}')
if bad:
    P('failures (station, picture frame, best j - i, residual at best, residual at i+0.5, pips):')
    for r in bad[:40]:
        js = np.array(r['js']); c = np.array(r['cost']); i = r['i']
        P(f'  st{r["k"]} i={i} best j-i={js[int(np.argmin(c))] - i:+.2f} cost {c.min():.2f} at i+0.5 {c[int(np.argmin(abs(js - i - 0.5)))]:.2f} pips {r["pips"]} {r["f"]}')
open(out, 'w', encoding='utf-8').write('\n'.join(lines))
