# Motion energy per frame of a clip's decoded frames (mean abs diff of consecutive frames, downscaled), as JSON.
# A needle = a frame whose change is > 3x both neighbours and > 4 (a hard cut). Same measure as direction/tools/energy.py.
# usage: python phone-bake-energy.py <dir with f-*.png> [fps]
import sys, glob, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; fps = float(sys.argv[2]) if len(sys.argv) > 2 else 25
fs = sorted(glob.glob(os.path.join(d, 'f-*.png')))
prev = None; e = []
for f in fs:
    a = np.asarray(Image.open(f).convert('L').resize((195, 422)), dtype=np.float32)
    if prev is not None: e.append(float(np.abs(a - prev).mean()))
    prev = a
e = np.array(e)
med = float(np.median(e[e > 0.05])) if (e > 0.05).any() else 0.0
needles = []
for i in range(1, len(e) - 1):
    if e[i] > 4 and e[i] > 3 * max(e[i - 1], e[i + 1], 0.3): needles.append({'t': round((i + 1) / fps, 2), 'e': round(float(e[i]), 2)})
top = np.argsort(e)[-6:][::-1]
print(json.dumps({'frames': len(fs), 'median': round(med, 2), 'max': round(float(e.max()), 2), 'needles': needles, 'top': [{'t': round((int(i) + 1) / fps, 2), 'e': round(float(e[i]), 2)} for i in top], 'energy': [round(float(v), 3) for v in e]}))
