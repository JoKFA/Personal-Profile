# Hard-cut check at the handoffs. The in-page clock (performance.now) of every handoff event is turned into wall-clock seconds and matched with the
# screencast's frame timestamps; for each event, the largest change between adjacent screencast frames within +-120 ms is reported against the
# noise floor (the same measure on frames of a still screen). A pop at the still -> clip -> still handoffs would show as a spike there: the clips
# start and end at rest, so the change there should be near the floor.
# usage: python cuts.py <screencast dir> <result-*.json>
import sys, glob, re, json
import numpy as np
from PIL import Image

sc, res = sys.argv[1], sys.argv[2]
R = json.load(open(res))
fs = sorted(glob.glob(sc + '/s-*.jpg'))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs])
g = lambda f: np.asarray(Image.open(f).convert('L').resize((195, 332)), dtype=np.float32)
cache = {}
def img(i):
    if i not in cache: cache[i] = g(fs[i])
    return cache[i]
def diffs(lo, hi):
    idx = [i for i in range(len(fs)) if lo <= ts[i] <= hi]
    return [(float(ts[i + 1] - ts[i]) * 1000, float(np.abs(img(i + 1) - img(i)).mean())) for i in idx if i + 1 < len(fs) and ts[i + 1] <= hi + 0.05]
# for each event: the change between the two screencast frames that straddle it, against the largest change between any other adjacent pair
# within 6 pairs either side. A hard cut is a straddling change well above its neighbours; motion that merely speeds up is not.
t0 = R['timeOrigin'] / 1000
adj = lambda i: float(np.abs(img(i + 1) - img(i)).mean())
worst = 0.0; flagged = 0
for h in R['handoffsRaw']:
    for name, key in (('first frame', 'firstFrameAt'), ('last frame + still', 'endAt')):
        t = h[key] / 1000 + t0
        k = int(np.searchsorted(ts, t)) - 1                 # last frame at or before the event
        if k < 7 or k + 8 >= len(fs): print('%-22s %-18s no frames around' % (h['clip'], name)); continue
        # screencast frames can arrive twice with the same picture: the straddle is the change across the first pair that differs
        st = max(adj(k - 1), adj(k), adj(k + 1))
        others = [adj(i) for i in range(k - 6, k + 7) if i not in (k - 1, k, k + 1)]
        ratio = st / max(max(others), 0.5)
        worst = max(worst, ratio); flagged += ratio > 1.5
        print('%-22s %-9s %-18s change at the event %.2f, largest other pair within 6 either side %.2f (ratio %.2f)' % (h['clip'], h['via'], name, st, max(others), ratio))
print('events: %d, flagged (ratio > 1.5): %d, worst ratio %.2f' % (2 * len(R['handoffsRaw']), flagged, worst))
