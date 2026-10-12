# compositor-level DOM sync: in each screencast frame of the open clip, which clip frame is the picture (nearest reference frame) and
# which frame's face corners are the four ink marks on? Their difference is the DOM's lag (+) or lead (-) in frames.
# usage: python phone-spike-domsync.py <screencast dir> <decoded open-clip frames dir (f-NNNN.png)> <manifest.json>
import sys, glob, json, re, os
import numpy as np
from PIL import Image
sc, refs, man = sys.argv[1], sys.argv[2], sys.argv[3]
M = json.load(open(man))['assets']['open-X-001']; quads = np.array(M['quads'])  # (50,4,2)
R = [np.asarray(Image.open(f).convert('L').resize((39, 87), Image.BOX), dtype=np.float32) for f in sorted(glob.glob(refs + '/f-*.png'))]
def marks(img):
    a = np.asarray(img.convert('L'), dtype=np.float32); a[790:] = 255
    m = a < 70
    # connected components, small
    lab = np.zeros(m.shape, int); n = 0; pts = []
    ys, xs = np.nonzero(m)
    seen = set()
    for y, x in zip(ys, xs):
        if (y, x) in seen: continue
        st = [(y, x)]; seen.add((y, x)); comp = []
        while st:
            cy, cx = st.pop(); comp.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (cy + dy, cx + dx)
                    if q not in seen and 0 <= q[0] < m.shape[0] and 0 <= q[1] < m.shape[1] and m[q]: seen.add(q); st.append(q)
        if 8 <= len(comp) <= 60: pts.append((np.mean([c[1] for c in comp]), np.mean([c[0] for c in comp])))
    return np.array(pts)
res = []
for f in sorted(glob.glob(sc + '/s-*.jpg')):
    img = Image.open(f).convert('RGB')
    g = np.asarray(img.convert('L').resize((39, 87), Image.BOX), dtype=np.float32)
    d = [np.abs(g - r).mean() for r in R]; fv = int(np.argmin(d))
    if d[fv] > 3.0: continue                       # not a frame of the open clip (cover, window, pan ...)
    p = marks(img)
    if len(p) != 4: continue
    # marks vs each frame's face corners (unordered sets), after the 0.16 s lock (frame >= 4) they sit on them
    cost = []
    for i in range(len(quads)):
        q = quads[i]; c = 0
        for pt in p: c += np.min(np.linalg.norm(q - pt, axis=1))
        cost.append(c / 4)
    fm = int(np.argmin(cost))
    res.append((fv, fm, float(d[fv]), float(cost[fm])))
res = [r for r in res if r[0] >= 6 and r[0] <= 44]   # clear of the lock ramp and of the settled tail where adjacent frames are the same picture
diff = [r[1] - r[0] for r in res]
print('screencast frames of the open clip analysed:', len(res))
vals, cnt = np.unique(diff, return_counts=True)
print('mark-frame minus picture-frame (frames):', dict(zip(map(int, vals), map(int, cnt))))
print('mean mark-to-corner distance px at best frame: %.2f' % np.mean([r[3] for r in res]))
