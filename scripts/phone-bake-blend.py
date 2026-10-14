# Blend the last N frames of a clip's frame directory, frame by frame, into the destination's canonical still, so the clip's
# last frame IS the still (weights 1/N ... 1).  usage: python phone-bake-blend.py <still.png> <frames_dir> <N>
# prints {"n": N, "diffs": [...]}: for each blended frame, how far it moved from the clean (unblended) frame, mean abs diff in % of 255.
# A blend may only absorb the idle residual between the clip's end and the still: the bake fails when any of these is >= 2%.
import sys, glob, os, json
import numpy as np
from PIL import Image
still_p, d, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
fs = sorted(glob.glob(os.path.join(d, 'f-*.png')))
first = Image.open(fs[-1]); size = first.size
still = np.asarray(Image.open(still_p).convert('RGB').resize(size, Image.LANCZOS), dtype=np.float32)
diffs = []
for j, f in enumerate(fs[-n:], start=1):
    w = j / n
    a = np.asarray(Image.open(f).convert('RGB'), dtype=np.float32)
    b = np.rint(a * (1 - w) + still * w).clip(0, 255)
    diffs.append(round(float(np.abs(b - a).mean() / 255 * 100), 3))
    Image.fromarray(b.astype(np.uint8)).save(f, compress_level=3)
print(json.dumps({'n': n, 'diffs': diffs}))
