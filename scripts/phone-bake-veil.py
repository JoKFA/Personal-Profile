# The way out's dissolve: the forward cut has the engine's own veil (archive.ts: a copy of the exterior's last frame laid over the interior's first frames,
# fading out over .45 s with cubic-bezier(.4, 0, .2, 1), so the interior "arrives under it"); that dissolve is in the door -> intro pixels. The way out has no veil,
# so the interior's last frames (warm, soft, low contrast) met the door's first frame (cool, crisp, grey) with a hard jump. Here the same dissolve runs backwards:
# the interior's last frames before the cut are blended toward the exterior's first frame with the veil's own opacity curve, so the frame before the cut IS (nearly)
# the exterior's frame. usage: python phone-bake-veil.py <frames dir> <first exterior frame index> [seconds=0.45] [fps=25]
#   -> {"n": frames blended, "weights": [...], "cut": <% the interior's last frame differed from the exterior's first before the blend>, "after": <% after>}
import sys, glob, os, json
import numpy as np
from PIL import Image
d, door = sys.argv[1], int(sys.argv[2]); secs = float(sys.argv[3]) if len(sys.argv) > 3 else 0.45; fps = float(sys.argv[4]) if len(sys.argv) > 4 else 25
fs = sorted(glob.glob(os.path.join(d, 'f-*.png')))
def bez(x):   # cubic-bezier(.4, 0, .2, 1): progress for time fraction x
    lo, hi = 0.0, 1.0
    for _ in range(60):
        t = (lo + hi) / 2
        if 3 * (1 - t) ** 2 * t * 0.4 + 3 * (1 - t) * t * t * 0.2 + t ** 3 < x: lo = t
        else: hi = t
    t = (lo + hi) / 2
    return 3 * (1 - t) * t * t + t ** 3
load = lambda f: np.asarray(Image.open(f).convert('RGB'), dtype=np.float32)
E = load(fs[door])
cut = float(np.abs(load(fs[door - 1]) - E).mean() / 255 * 100)
n = int(round(secs * fps)); ws = []
for j in range(door - n, door):
    if j < 0: continue
    tau = (door - j) / fps                    # seconds before the cut
    o = 1 - bez(min(1, tau / secs))           # the veil's opacity that far from the cut, as it is that far after it going forward
    ws.append(round(o, 3))
    a = load(fs[j]); Image.fromarray(np.rint(a * (1 - o) + E * o).clip(0, 255).astype(np.uint8)).save(fs[j], compress_level=3)
after = float(np.abs(load(fs[door - 1]) - E).mean() / 255 * 100)
print(json.dumps({'n': len(ws), 'weights': ws, 'cut': round(cut, 3), 'after': round(after, 3)}))
